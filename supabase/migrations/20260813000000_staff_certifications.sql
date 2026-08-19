-- ============================================================================
-- Migration — Staff Certifications & Qualifications
-- ============================================================================
-- Creates a database-driven certifications system for staff/doctors with:
-- - DID association (verified staff identity)
-- - Hospital scoping (multi-tenancy support)
-- - Admin management capabilities
-- - Audit logging for all changes
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type certification_status as enum ('active', 'expired', 'revoked', 'pending');

-- ─── staff_certifications ───────────────────────────────────────────────────
create table public.staff_certifications (
  cert_id          text primary key default ('CERT-' || upper(substring(gen_random_uuid()::text, 1, 8))),
  staff_did        text not null references public.dids(did) on delete cascade,
  -- uuid with a real foreign key, matching every other tenant-scoped table.
  -- This was 'text not null' with no reference, which both allowed values that
  -- match no hospital and made the scoping helper compare text to uuid.
  hospital_id      uuid not null references public.hospitals(hospital_id) on delete cascade,
  
  -- Certification details
  cert_name        text not null,
  cert_type        text,                    -- e.g., 'degree', 'license', 'training'
  issuing_body     text not null,           -- e.g., 'AIIMS Delhi', 'Medical Council'
  issue_date       date,
  expiry_date      date,
  cert_number      text,                    -- Certificate/License number
  status           certification_status not null default 'active',
  
  -- Attachments and verification
  document_url     text,                    -- Link to certificate document
  verification_url text,                    -- External verification link
  verified_by_admin boolean not null default false,
  
  -- Metadata
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null,
  updated_by       uuid references auth.users(id) on delete set null,
  
  -- Audit fields for logging
  audit_metadata   jsonb not null default '{}'::jsonb,

  -- Constraints
  constraint cert_dates_valid 
    check (expiry_date is null or expiry_date > issue_date)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index staff_certifications_staff_did_idx on public.staff_certifications (staff_did);
create index staff_certifications_hospital_id_idx on public.staff_certifications (hospital_id);
create index staff_certifications_status_idx on public.staff_certifications (status);
create index staff_certifications_expiry_idx on public.staff_certifications (expiry_date)
  where status = 'active' and expiry_date is not null;

comment on table public.staff_certifications is
  'Staff certifications and qualifications linked to verified DIDs with hospital scoping and audit trails.';

-- ─── certification_audit_log ────────────────────────────────────────────────
-- Detailed audit log for all certification changes
create table public.certification_audit_log (
  audit_id       uuid primary key default gen_random_uuid(),
  cert_id        text not null,             -- May reference deleted cert
  staff_did      text not null,
  action         text not null,             -- 'created', 'updated', 'deleted', 'status_changed'
  
  -- Change tracking
  field_changed  text,                      -- Specific field that changed
  old_value      text,
  new_value      text,
  
  -- Actor information
  performed_by   uuid references auth.users(id) on delete set null,
  performed_by_name text,
  performed_by_role text,
  
  -- Context
  hospital_id    uuid references public.hospitals(hospital_id) on delete set null,
  reason         text,                      -- Optional reason for change
  logged_at      timestamptz not null default now(),
  
  -- Full snapshot for major changes
  full_snapshot  jsonb
);

create index certification_audit_log_cert_id_idx on public.certification_audit_log (cert_id);
create index certification_audit_log_staff_did_idx on public.certification_audit_log (staff_did);
create index certification_audit_log_logged_at_idx on public.certification_audit_log (logged_at desc);

comment on table public.certification_audit_log is
  'Comprehensive audit trail for all certification modifications with before/after values.';

-- ─── Helper function for hospital scoping ───────────────────────────────────
-- Returns true if the certification belongs to the user's hospital
-- Parameter is uuid: profiles.hospital_id is uuid, so a text parameter made this
-- fail to create with 'operator does not exist: text = uuid'.
-- NOTE: this duplicates private.can_access_hospital(uuid), which also allows a
-- super_admin. Worth consolidating.
create or replace function private.cert_in_user_hospital(cert_hospital_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select cert_hospital_id = (
    select hospital_id 
    from public.profiles 
    where id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.staff_certifications enable row level security;
alter table public.certification_audit_log enable row level security;

-- ─── staff_certifications policies ──────────────────────────────────────────

-- Staff/doctors can view their own certifications
create policy staff_certifications_select_own on public.staff_certifications
  for select to authenticated
  using (staff_did in (select private.current_user_dids()));

-- Staff in the same hospital can view each other's certifications (transparency)
create policy staff_certifications_select_hospital on public.staff_certifications
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.cert_in_user_hospital(hospital_id)
  );

-- Only admins can insert certifications
create policy staff_certifications_insert_admin on public.staff_certifications
  for insert to authenticated
  with check (
    private.current_user_role() = 'admin'
    and private.cert_in_user_hospital(hospital_id)
  );

-- Only admins can update certifications
create policy staff_certifications_update_admin on public.staff_certifications
  for update to authenticated
  using (
    private.current_user_role() = 'admin'
    and private.cert_in_user_hospital(hospital_id)
  )
  with check (
    private.current_user_role() = 'admin'
    and private.cert_in_user_hospital(hospital_id)
  );

-- Only admins can delete certifications (soft delete via status preferred)
create policy staff_certifications_delete_admin on public.staff_certifications
  for delete to authenticated
  using (
    private.current_user_role() = 'admin'
    and private.cert_in_user_hospital(hospital_id)
  );

-- ─── certification_audit_log policies ───────────────────────────────────────

-- Staff can view audit logs for their own certifications
create policy certification_audit_log_select_own on public.certification_audit_log
  for select to authenticated
  using (staff_did in (select private.current_user_dids()));

-- Admins can view all audit logs in their hospital
create policy certification_audit_log_select_admin on public.certification_audit_log
  for select to authenticated
  using (
    private.current_user_role() = 'admin'
    and private.cert_in_user_hospital(hospital_id)
  );

-- Only system (service_role) can insert audit logs
-- No client INSERT policy - logs are created by triggers/functions

-- ─── Audit trigger function ─────────────────────────────────────────────────
create or replace function private.log_certification_change()
returns trigger
language plpgsql
security definer
as $$
declare
  actor_profile record;
  action_type text;
begin
  -- Get actor information
  select full_name, role, hospital_id
  into actor_profile
  from public.profiles
  where id = auth.uid();

  -- Determine action type
  if TG_OP = 'INSERT' then
    action_type := 'created';
  elsif TG_OP = 'UPDATE' then
    if OLD.status != NEW.status then
      action_type := 'status_changed';
    else
      action_type := 'updated';
    end if;
  elsif TG_OP = 'DELETE' then
    action_type := 'deleted';
  end if;

  -- Log the change
  if TG_OP = 'DELETE' then
    insert into public.certification_audit_log (
      cert_id,
      staff_did,
      action,
      performed_by,
      performed_by_name,
      performed_by_role,
      hospital_id,
      full_snapshot
    ) values (
      OLD.cert_id,
      OLD.staff_did,
      action_type,
      auth.uid(),
      actor_profile.full_name,
      actor_profile.role,
      OLD.hospital_id,
      to_jsonb(OLD)
    );
  else
    -- For INSERT and UPDATE, log detailed changes
    if TG_OP = 'INSERT' then
      insert into public.certification_audit_log (
        cert_id,
        staff_did,
        action,
        performed_by,
        performed_by_name,
        performed_by_role,
        hospital_id,
        full_snapshot
      ) values (
        NEW.cert_id,
        NEW.staff_did,
        action_type,
        auth.uid(),
        actor_profile.full_name,
        actor_profile.role,
        NEW.hospital_id,
        to_jsonb(NEW)
      );
    elsif TG_OP = 'UPDATE' then
      -- Log each changed field
      if OLD.cert_name != NEW.cert_name then
        insert into public.certification_audit_log (
          cert_id, staff_did, action, field_changed, old_value, new_value,
          performed_by, performed_by_name, performed_by_role, hospital_id
        ) values (
          NEW.cert_id, NEW.staff_did, action_type, 'cert_name', OLD.cert_name, NEW.cert_name,
          auth.uid(), actor_profile.full_name, actor_profile.role, NEW.hospital_id
        );
      end if;
      
      if OLD.issuing_body != NEW.issuing_body then
        insert into public.certification_audit_log (
          cert_id, staff_did, action, field_changed, old_value, new_value,
          performed_by, performed_by_name, performed_by_role, hospital_id
        ) values (
          NEW.cert_id, NEW.staff_did, action_type, 'issuing_body', OLD.issuing_body, NEW.issuing_body,
          auth.uid(), actor_profile.full_name, actor_profile.role, NEW.hospital_id
        );
      end if;
      
      if OLD.status::text != NEW.status::text then
        insert into public.certification_audit_log (
          cert_id, staff_did, action, field_changed, old_value, new_value,
          performed_by, performed_by_name, performed_by_role, hospital_id
        ) values (
          NEW.cert_id, NEW.staff_did, action_type, 'status', OLD.status::text, NEW.status::text,
          auth.uid(), actor_profile.full_name, actor_profile.role, NEW.hospital_id
        );
      end if;

      if (OLD.expiry_date is distinct from NEW.expiry_date) then
        insert into public.certification_audit_log (
          cert_id, staff_did, action, field_changed, old_value, new_value,
          performed_by, performed_by_name, performed_by_role, hospital_id
        ) values (
          NEW.cert_id, NEW.staff_did, action_type, 'expiry_date', 
          OLD.expiry_date::text, NEW.expiry_date::text,
          auth.uid(), actor_profile.full_name, actor_profile.role, NEW.hospital_id
        );
      end if;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

-- ─── Attach audit trigger ───────────────────────────────────────────────────
create trigger staff_certifications_audit_trigger
  after insert or update or delete on public.staff_certifications
  for each row execute function private.log_certification_change();

-- ─── updated_at trigger ─────────────────────────────────────────────────────
create trigger staff_certifications_touch_updated_at
  before update on public.staff_certifications
  for each row execute function public.touch_updated_at();

-- ─── Enable Realtime ─────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.staff_certifications;

comment on table public.staff_certifications is
  'Staff certifications with DID linking, hospital scoping, admin management, and comprehensive audit trails.';
