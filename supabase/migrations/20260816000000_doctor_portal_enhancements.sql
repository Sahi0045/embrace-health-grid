-- ============================================================================
-- Migration: Doctor Portal Enhancements
-- ============================================================================
-- Adds:
--   1. Create missing helper functions (has_active_consent, current_user_dids)
--   2. Fix RLS function references (private. → public.)
--   3. Add appointment_id to prescriptions
--   4. Create prescription_items table for normalized medicine storage
--   5. Create medical_reports table with file storage support
--   6. Enhanced RLS policies for doctor portal
-- ============================================================================

-- ─── Create helper functions if they don't exist ─────────────────────────────
-- These are referenced by RLS policies but may not exist in the database

-- Every DID owned by the current user (a user may hold more than one).
create or replace function public.current_user_dids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select did from public.dids where owner_id = auth.uid();
$$;

-- Current user's role, read from profiles.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

-- True when the current user is a clinician holding a live consent for this
-- patient. Expiry is evaluated here so revoked/lapsed grants stop granting
-- access without a background job.
create or replace function public.has_active_consent(target_patient_did text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.consents c
    where c.patient_did = target_patient_did
      and c.doctor_did in (select did from public.dids where owner_id = auth.uid())
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > now())
  );
$$;

-- Automatically update updated_at timestamp on row updates
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Fix existing RLS policies ──────────────────────────────────────────────
-- The existing migration references private.current_user_dids() etc but those
-- functions are in public schema. This fixes the references.

-- Drop existing policies that reference private schema
drop policy if exists prescriptions_select_consented on public.prescriptions;
drop policy if exists prescriptions_insert_clinician on public.prescriptions;
drop policy if exists appointments_select_involved on public.appointments;
drop policy if exists appointments_insert_patient on public.appointments;
drop policy if exists appointments_update_involved on public.appointments;

-- Recreate with correct public schema references
create policy prescriptions_select_consented on public.prescriptions
  for select to authenticated
  using (public.has_active_consent(patient_did));

create policy prescriptions_insert_clinician on public.prescriptions
  for insert to authenticated
  with check (
    public.current_user_role() in ('doctor', 'staff')
    and doctor_did in (select public.current_user_dids())
    and public.has_active_consent(patient_did)
  );

create policy appointments_select_involved on public.appointments
  for select to authenticated
  using (
    patient_did in (select public.current_user_dids())
    or doctor_did in (select public.current_user_dids())
  );

create policy appointments_insert_patient on public.appointments
  for insert to authenticated
  with check (patient_did in (select public.current_user_dids()));

create policy appointments_update_involved on public.appointments
  for update to authenticated
  using (
    patient_did in (select public.current_user_dids())
    or doctor_did in (select public.current_user_dids())
  )
  with check (
    patient_did in (select public.current_user_dids())
    or doctor_did in (select public.current_user_dids())
  );

-- ─── Enhance prescriptions table ────────────────────────────────────────────
-- Add appointment_id for better tracking and allow NULL for legacy records
alter table public.prescriptions 
  add column if not exists appointment_id text references public.appointments(appt_id) on delete set null;

create index if not exists prescriptions_appointment_id_idx on public.prescriptions (appointment_id);

-- Add suggested_slot column to appointments if not exists
alter table public.appointments
  add column if not exists suggested_slot text;

-- ─── prescription_items table ───────────────────────────────────────────────
-- Normalized storage for individual medicines in a prescription
-- This is MORE space-efficient than duplicating patient/doctor data in each item
create table if not exists public.prescription_items (
  item_id         text primary key default ('rxitem_' || substr(md5(random()::text), 1, 12)),
  prescription_id text not null references public.prescriptions(rx_id) on delete cascade,
  medicine_name   text not null,
  dosage          text not null,
  frequency       text not null,
  duration        text not null,
  instructions    text,
  created_at      timestamptz not null default now()
);

create index if not exists prescription_items_prescription_id_idx on public.prescription_items (prescription_id);

-- ─── medical_reports table ──────────────────────────────────────────────────
-- Store medical reports with optional file attachments via Supabase Storage
create table if not exists public.medical_reports (
  report_id     text primary key default ('report_' || substr(md5(random()::text), 1, 12)),
  patient_did   text not null references public.dids(did) on delete cascade,
  doctor_did    text not null references public.dids(did) on delete restrict,
  appointment_id text references public.appointments(appt_id) on delete set null,
  report_type   text not null default 'consultation', -- consultation, lab, imaging, procedure, discharge
  title         text not null,
  summary       text,
  findings      text,
  recommendations text,
  file_path     text,  -- Supabase Storage path: bucket/folder/filename
  file_url      text,  -- Public or signed URL for the file
  file_size     bigint,
  file_type     text,  -- application/pdf, image/jpeg, etc
  status        text not null default 'draft', -- draft, finalized
  signed        boolean not null default false,
  signed_by     text,
  signed_at     timestamptz,
  content_hash  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index medical_reports_patient_did_idx on public.medical_reports (patient_did);
create index medical_reports_doctor_did_idx on public.medical_reports (doctor_did);
create index medical_reports_appointment_id_idx on public.medical_reports (appointment_id);
create index medical_reports_created_at_idx on public.medical_reports (created_at desc);

-- ─── RLS for prescription_items ─────────────────────────────────────────────
alter table public.prescription_items enable row level security;

-- Patient can see items from their own prescriptions
create policy prescription_items_select_own on public.prescription_items
  for select to authenticated
  using (
    prescription_id in (
      select rx_id from public.prescriptions 
      where patient_did in (select public.current_user_dids())
    )
  );

-- Doctor who authored the prescription can see items
create policy prescription_items_select_author on public.prescription_items
  for select to authenticated
  using (
    prescription_id in (
      select rx_id from public.prescriptions 
      where doctor_did in (select public.current_user_dids())
    )
  );

-- Doctor with active consent can see items
create policy prescription_items_select_consented on public.prescription_items
  for select to authenticated
  using (
    prescription_id in (
      select rx_id from public.prescriptions 
      where public.has_active_consent(patient_did)
    )
  );

-- Only the prescribing doctor can insert items
create policy prescription_items_insert_clinician on public.prescription_items
  for insert to authenticated
  with check (
    public.current_user_role() in ('doctor', 'staff')
    and prescription_id in (
      select rx_id from public.prescriptions 
      where doctor_did in (select public.current_user_dids())
    )
  );

-- ─── RLS for medical_reports ────────────────────────────────────────────────
alter table public.medical_reports enable row level security;

-- Patient can see their own reports
create policy medical_reports_select_own on public.medical_reports
  for select to authenticated
  using (patient_did in (select public.current_user_dids()));

-- Doctor who authored the report can see it
create policy medical_reports_select_author on public.medical_reports
  for select to authenticated
  using (doctor_did in (select public.current_user_dids()));

-- Doctor with active consent can see patient's reports
create policy medical_reports_select_consented on public.medical_reports
  for select to authenticated
  using (public.has_active_consent(patient_did));

-- Only doctors/staff can create reports for patients with consent
create policy medical_reports_insert_clinician on public.medical_reports
  for insert to authenticated
  with check (
    public.current_user_role() in ('doctor', 'staff')
    and doctor_did in (select public.current_user_dids())
    and public.has_active_consent(patient_did)
  );

-- Only the authoring doctor can update their own draft reports
create policy medical_reports_update_author on public.medical_reports
  for update to authenticated
  using (
    doctor_did in (select public.current_user_dids())
    and status = 'draft'
  )
  with check (
    doctor_did in (select public.current_user_dids())
  );

-- ─── Updated_at triggers ────────────────────────────────────────────────────
-- Use DROP IF EXISTS for safe reruns
drop trigger if exists prescriptions_touch_updated_at on public.prescriptions;
create trigger prescriptions_touch_updated_at
  before update on public.prescriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists medical_reports_touch_updated_at on public.medical_reports;
create trigger medical_reports_touch_updated_at
  before update on public.medical_reports
  for each row execute function public.touch_updated_at();

drop trigger if exists appointments_touch_updated_at on public.appointments;
create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

-- ─── Helper function for prescription with items ────────────────────────────
-- Returns prescription with its items as JSON for easy API consumption
create or replace function public.get_prescription_with_items(prescription_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'rx_id', p.rx_id,
    'patient_did', p.patient_did,
    'doctor_did', p.doctor_did,
    'appointment_id', p.appointment_id,
    'diagnosis', p.diagnosis,
    'notes', p.notes,
    'status', p.status,
    'signed', p.signed,
    'signed_by', p.signed_by,
    'signed_at', p.signed_at,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'item_id', i.item_id,
            'medicine_name', i.medicine_name,
            'dosage', i.dosage,
            'frequency', i.frequency,
            'duration', i.duration,
            'instructions', i.instructions
          )
          order by i.created_at
        )
        from public.prescription_items i
        where i.prescription_id = p.rx_id
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.prescriptions p
  where p.rx_id = prescription_id;
  
  return result;
end;
$$;

-- ─── Comments ───────────────────────────────────────────────────────────────
comment on table public.prescription_items is 'Normalized medicine storage - avoids duplicating prescription metadata';
comment on table public.medical_reports is 'Medical reports with optional file attachments via Supabase Storage';
comment on column public.prescriptions.appointment_id is 'Links prescription to specific appointment for tracking';
comment on column public.medical_reports.file_path is 'Supabase Storage path: medical-reports/patient-did/filename';
comment on column public.medical_reports.report_type is 'consultation, lab, imaging, procedure, discharge';

