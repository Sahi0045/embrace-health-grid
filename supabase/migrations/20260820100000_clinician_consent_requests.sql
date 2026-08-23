-- ============================================================================
-- Consent requests initiated by a clinician
-- ============================================================================
-- The doctor side of consent was never migrated off the Express backend. The
-- three helpers behind /staff/consent (getMyConsents, getMyConsentRequests,
-- requestConsent) still issued HTTP calls to http://localhost:3001/consent/*,
-- a server that was decommissioned in the Supabase migration. The page therefore
-- loaded but always showed zero, and "Request Access" could never succeed.
--
-- A consent request is already modelled as a row in public.consents with
-- status = 'pending'; the patient's Requests tab reads exactly that, and
-- approving or denying transitions the row. The missing piece was write access:
-- consents_insert_patient restricts INSERT to the patient, so a clinician had no
-- way to ask for access at all.
--
-- This adds a narrow INSERT policy for clinicians. It is deliberately tighter
-- than the patient's:
--
--   * status must be 'pending' — a clinician cannot mint themselves active
--     access, only ask for it. The patient's UPDATE policy remains the only way
--     to reach 'active'.
--   * doctor_did must be one of the caller's own DIDs, so a clinician cannot
--     raise a request in a colleague's name.
--   * granted_at / expires_at are left to the patient's approval; a request only
--     proposes a resource.
--
-- Cross-hospital by design, like the rest of consent: a clinician at hospital B
-- must be able to ask a patient treated at hospital A for access, which is the
-- referral case the Stage 4 PHI decision exists to support.

drop policy if exists consents_insert_clinician_request on public.consents;

create policy consents_insert_clinician_request on public.consents
  for insert to authenticated
  with check (
    private.current_user_role() in ('doctor', 'staff')
    and doctor_did in (select private.current_user_dids())
    and status = 'pending'
  );

comment on table public.consents is
  'Consent grants and pending requests. A patient may insert an active grant directly; a clinician may only insert a pending request naming themselves, and only the patient can move it to active. No DELETE — revocation is a status change so the history survives.';

-- ─── Guard ──────────────────────────────────────────────────────────────────
-- A clinician must never be able to write an active grant. If the policy above
-- is ever widened to allow it, consent stops meaning anything, so fail loudly.
do $$
declare
  offending text;
begin
  select string_agg(policyname, ', ')
    into offending
    from pg_policies
   where schemaname = 'public'
     and tablename = 'consents'
     and cmd = 'INSERT'
     and policyname = 'consents_insert_clinician_request'
     and coalesce(with_check, '') not like '%pending%';

  if offending is not null then
    raise exception
      'A clinician consent-request policy must constrain status to pending: %',
      offending;
  end if;
end $$;
