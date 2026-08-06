-- ============================================================================
-- Clinical write policies — 11 tables were readable but not writable
-- ============================================================================
-- The clinical domain tables were created with SELECT policies only, so a
-- clinician could read a lab result but never record one:
--
--   lab_results     2 SELECT   0 INSERT
--   vitals          2 SELECT   0 INSERT
--   surgeries       2 SELECT   0 INSERT
--   ... 8 more
--
-- The pages exist and load, but every write failed with "new row violates
-- row-level security policy". Nothing surfaced it because the tables were empty,
-- so the read path had nothing to contradict.
--
-- Same gate as medical_records, which was done correctly:
--   role in ('doctor','staff')  AND  an active consent from that patient
--
-- Consent rather than hospital membership, deliberately — see the Stage 4
-- migration. A clinician treating a referred patient must be able to record the
-- treatment, and they hold consent rather than sharing a tenant.
-- ============================================================================

-- ─── Clinical records written by a treating clinician ───────────────────────
-- Each needs consent, because writing to a patient's chart is as sensitive as
-- reading it: a fabricated record is a clinical safety issue, not just a privacy
-- one.
do $$
declare
  t text;
begin
  foreach t in array array[
    'lab_results',
    'vitals',
    'surgeries',
    'procedures',
    'vaccines',
    'admissions',
    'medications',
    'daily_checkups',
    'diet_orders',
    'rehab_sessions',
    'pharmacy_orders'
  ]
  loop
    execute format($f$
      drop policy if exists %1$I_insert_clinician on public.%1$I;
      create policy %1$I_insert_clinician on public.%1$I
        for insert to authenticated
        with check (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        );
    $f$, t);

    -- Updates are scoped the same way. A correction to a lab value or a
    -- discharge date is a normal part of care, so it must be possible — but only
    -- for a clinician who still holds consent.
    execute format($f$
      drop policy if exists %1$I_update_clinician on public.%1$I;
      create policy %1$I_update_clinician on public.%1$I
        for update to authenticated
        using (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        )
        with check (
          private.current_user_role() in ('doctor', 'staff')
          and private.has_active_consent(patient_did)
        );
    $f$, t);
  end loop;
end $$;

-- ─── No DELETE anywhere ─────────────────────────────────────────────────────
-- Deliberately omitted. A clinical record is part of the patient's history and a
-- deletion would destroy the audit trail; corrections happen by update or by a
-- superseding record. Purging for a legal request is a service_role operation,
-- performed deliberately rather than available to any clinician.

comment on table public.lab_results is
  'Lab results. Writable by a clinician holding active consent from the patient; no DELETE policy — corrections are updates so the history survives.';

comment on table public.vitals is
  'Vitals. Writable by a clinician holding active consent. Published to Realtime, so RLS filters events per subscriber.';
