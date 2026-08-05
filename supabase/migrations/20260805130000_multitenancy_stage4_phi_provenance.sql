-- ============================================================================
-- Multi-tenancy Stage 4 — clinical PHI: provenance, NOT a tenant gate
-- ============================================================================
-- This is the load-bearing decision of the whole migration, so it is written
-- down rather than left implicit in policy text.
--
-- Clinical records are NOT hospital-scoped. They stay patient-owned and
-- consent-gated, and they cross hospital boundaries by design.
--
-- Why, concretely:
--   A patient treated at hospital A is referred to hospital B. If
--   medical_records were gated on hospital_id, the specialist at B could not
--   read that history even with the patient's explicit consent, and the patient
--   would have no way to grant it. That is precisely the failure a DID/VC health
--   record is meant to eliminate — the record follows the patient, not the
--   institution.
--
-- What hospital_id means on these tables:
--   Provenance only — which hospital created the row. It answers "where was
--   this recorded", supports per-hospital reporting, and gives an auditor the
--   origin of a record. It is deliberately NOT referenced in any SELECT policy.
--
-- What still protects these tables (unchanged by this migration):
--   - <table>_select_own        patient reads their own records
--   - <table>_select_consented  clinician reads only with active, unexpired
--                               consent from that patient
--   - insert requires role in ('doctor','staff') AND active consent
--   Admins have no blanket PHI read; break-glass remains the audited exception.
--
-- If hard per-hospital PHI isolation is ever required (a different product
-- decision, e.g. a jurisdiction that forbids cross-border record access), the
-- change is to add `and private.can_access_hospital(hospital_id)` to the
-- _select_consented policies. It is one line per table, and it would break
-- referrals — which is why it is not the default.
-- ============================================================================

-- ─── 1. Provenance column on clinical tables ────────────────────────────────
alter table public.medical_records     add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.prescriptions       add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.lab_results         add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.vitals              add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.admissions          add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.procedures          add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.surgeries           add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.medications         add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.nursing_notes       add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.daily_checkups      add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.diet_orders         add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.rehab_sessions      add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.vaccines            add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.pharmacy_orders     add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.appointments        add column if not exists hospital_id uuid references public.hospitals (hospital_id);
alter table public.health_metrics      add column if not exists hospital_id uuid references public.hospitals (hospital_id);

comment on column public.medical_records.hospital_id is
  'Provenance: the hospital that recorded this. NOT a read gate — access is governed by patient ownership and consent, so records follow the patient across hospitals.';

-- Reporting queries filter by hospital even though policies do not.
create index if not exists medical_records_hospital_idx on public.medical_records (hospital_id);
create index if not exists prescriptions_hospital_idx   on public.prescriptions (hospital_id);
create index if not exists lab_results_hospital_idx     on public.lab_results (hospital_id);
create index if not exists admissions_hospital_idx      on public.admissions (hospital_id);
create index if not exists appointments_hospital_idx    on public.appointments (hospital_id);

-- ─── 2. Backfill ────────────────────────────────────────────────────────────
do $$
declare
  seed_hospital uuid;
begin
  select hospital_id into seed_hospital
    from public.hospitals where slug = 'apollo-consortium-general';

  if seed_hospital is null then
    raise exception 'Stage 1 seed hospital is missing; run migrations in order';
  end if;

  update public.medical_records set hospital_id = seed_hospital where hospital_id is null;
  update public.prescriptions   set hospital_id = seed_hospital where hospital_id is null;
  update public.lab_results     set hospital_id = seed_hospital where hospital_id is null;
  update public.vitals          set hospital_id = seed_hospital where hospital_id is null;
  update public.admissions      set hospital_id = seed_hospital where hospital_id is null;
  update public.procedures      set hospital_id = seed_hospital where hospital_id is null;
  update public.surgeries       set hospital_id = seed_hospital where hospital_id is null;
  update public.medications     set hospital_id = seed_hospital where hospital_id is null;
  update public.nursing_notes   set hospital_id = seed_hospital where hospital_id is null;
  update public.daily_checkups  set hospital_id = seed_hospital where hospital_id is null;
  update public.diet_orders     set hospital_id = seed_hospital where hospital_id is null;
  update public.rehab_sessions  set hospital_id = seed_hospital where hospital_id is null;
  update public.vaccines        set hospital_id = seed_hospital where hospital_id is null;
  update public.pharmacy_orders set hospital_id = seed_hospital where hospital_id is null;
  update public.appointments    set hospital_id = seed_hospital where hospital_id is null;
  update public.health_metrics  set hospital_id = seed_hospital where hospital_id is null;
end $$;

-- ─── 3. Record the decision where it will be found ──────────────────────────
-- A policy row is the first place someone reviewing tenancy will look, so the
-- rationale lives next to the policies rather than only in this file.
comment on table public.medical_records is
  'Patient-owned clinical records. Deliberately NOT hospital-scoped: access follows patient consent so records survive a referral to another hospital. hospital_id is provenance.';

comment on table public.consents is
  'Patient-granted access. Cross-hospital by design — a patient may grant a clinician at any hospital access to their records.';

-- ─── 4. Prove the cross-hospital path is intact ─────────────────────────────
-- Fails the migration if a future change turns consent into a same-hospital
-- check. Cheaper to catch here than in a referral that silently returns
-- nothing.
do $$
declare
  offending text;
begin
  select string_agg(policyname, ', ')
    into offending
    from pg_policies
   where schemaname = 'public'
     and tablename in ('medical_records', 'prescriptions', 'lab_results', 'vitals')
     and cmd = 'SELECT'
     and qual like '%can_access_hospital%';

  if offending is not null then
    raise exception
      'Clinical SELECT policies must not be hospital-gated, or referrals break: %',
      offending;
  end if;
end $$;
