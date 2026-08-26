-- ============================================================================
-- PHI LEAK: views bypass RLS on every table they read
-- ============================================================================
-- A Postgres view executes with the privileges of its OWNER unless it is
-- declared `security_invoker = true`. These eight views are owned by the
-- migration role and were all created without it, so selecting from one runs as
-- the owner and NONE of the row-level security on the underlying tables is
-- applied. The only filter left is whatever the caller puts in the WHERE clause.
--
-- `public.patient_master` is the severe case. It joins dids, admissions, beds,
-- rooms, wards, floors, buildings, billing_accounts, insurance_policies and
-- patient_preferences into one row per patient, and
-- patient-master.server.ts filters it by a patientDid taken straight from the
-- request body — under a comment reading "RLS will enforce visibility". It does
-- not. Verified against the live database by signing in as a seeded PATIENT and
-- reading another patient's row:
--
--   bob.patient@seed.test  ->  did:hosp:0xSEEDA01
--     {"patient_name":"Alice Tan", "diagnosis":"Unstable angina — observation",
--      "admission_id":"SEED-ADM-A1", "admission_status":"admitted", ...}
--
--   bob.patient@seed.test  ->  did:hosp:0xSEEDC03   (DIFFERENT HOSPITAL)
--     {"patient_name":"Carol Nair", "hospital_name":"City Care Hospital", ...}
--
-- So this is not a staff-only over-reach: any authenticated user of any role
-- could read any patient's identity, diagnosis and admission state, across
-- tenant boundaries, by guessing or enumerating a DID. `dids` is readable
-- enough to make enumeration easy.
--
-- `security_invoker = true` makes each view run as the CALLER, so every policy
-- on the base tables applies again and the view returns exactly the rows that
-- caller could have selected directly. That is what these views were always
-- documented to do.

alter view public.patient_master            set (security_invoker = true);
alter view public.patient_current_location  set (security_invoker = true);
alter view public.patient_admission_history set (security_invoker = true);

-- Same defect, lower blast radius, fixed for the same reason: a view must not
-- be a way around the policies on what it reads.
alter view public.ward_occupancy               set (security_invoker = true);
alter view public.signing_events_confirmed     set (security_invoker = true);
alter view public.signing_events_phantom_users set (security_invoker = true);
alter view public.signing_events_embedded      set (security_invoker = true);
alter view public.signing_events_failed        set (security_invoker = true);

comment on view public.patient_master is
  'Unified read-only patient record. security_invoker = true: this view enforces the caller''s RLS on every table it joins. Do NOT recreate it without that setting — without it the view returns every patient in every hospital to any authenticated caller, regardless of role or consent.';

-- ─── Guard ──────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE VIEW does not preserve reloptions, so a later edit to any
-- of these definitions silently reopens the hole. Fail the migration instead.
do $$
declare
  leaky text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into leaky
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'v'
     and coalesce((
       select option_value::boolean
         from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker'
     ), false) is not true;

  if leaky is not null then
    raise exception 'These public views run as owner and bypass RLS: %. Add `security_invoker = true`.', leaky;
  end if;
end $$;
