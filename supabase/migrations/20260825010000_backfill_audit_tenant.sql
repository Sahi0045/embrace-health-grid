-- ============================================================================
-- Backfill audit tenancy
-- ============================================================================
-- audit_events.who_hospital_id was never stamped by the Edge Function audit
-- helper, so 198 of 200 live rows carry NULL. The read policy is hospital
-- scoped, which means every hospital administrator saw an EMPTY audit trail —
-- the people responsible for auditing the system could not read it.
--
-- The helper is fixed going forward (supabase/functions/_shared/deps.ts now
-- routes through write_audit_record() and stamps the caller). This reconciles
-- the rows written before that.
--
-- Safe to write: these rows have record_hash NULL. Only rows created through
-- write_audit_record() are hashed, and the direct INSERT the Edge Functions used
-- bypassed it entirely — so there is no integrity value to invalidate here.
--
-- Deliberately NOT done: computing record_hash for these rows retrospectively.
-- A hash calculated now, over data that could already have been altered, proves
-- nothing and would misrepresent unverifiable rows as verified. They stay
-- unhashed and therefore honestly outside the tamper-evidence guarantee.

-- 1. Attribute via the acting user's profile.
update public.audit_events a
   set who_hospital_id = p.hospital_id,
       who_role        = coalesce(a.who_role, p.role::text),
       who_name        = coalesce(a.who_name, p.full_name),
       who_email       = coalesce(a.who_email, p.email)
  from public.profiles p
 where a.who_hospital_id is null
   and a.actor_id = p.id
   and p.hospital_id is not null;

-- 2. Fall back to the acting DID, for rows that recorded a DID but no user id.
update public.audit_events a
   set who_hospital_id = p.hospital_id,
       who_role        = coalesce(a.who_role, p.role::text),
       who_name        = coalesce(a.who_name, p.full_name),
       who_email       = coalesce(a.who_email, p.email)
  from public.dids d
  join public.profiles p on p.id = d.owner_id
 where a.who_hospital_id is null
   and a.actor_did is not null
   and a.actor_did = d.did
   and p.hospital_id is not null;

-- Rows that match neither keep who_hospital_id NULL. That is the correct
-- outcome: the event genuinely does not record who performed it, and guessing a
-- tenant on an audit record would be worse than admitting the gap.

comment on column public.audit_events.who_hospital_id is
  'Owning hospital, stamped at write time by write_audit_record(). Rows predating the Edge Function fix may be NULL where the actor could not be resolved; those rows are also unhashed and outside the integrity guarantee.';
