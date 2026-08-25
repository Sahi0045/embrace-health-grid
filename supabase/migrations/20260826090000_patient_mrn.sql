-- ============================================================================
-- Medical record number as a real column
-- ============================================================================
-- The MRN is the number on a patient's wristband and the one staff read out on
-- the phone, but it existed nowhere in the schema. Onboarding collected it and
-- wrote it only into `credentials.claims->>'mrn'` — a signed VC payload — so:
--
--   * nothing read it back: CurrentUser.mrn was declared and never populated,
--     and the patient profile rendered "MRN:" followed by nothing;
--   * it could not be searched: admin.people filters on `p.mrn`, which was
--     always undefined, so searching by MRN never matched anyone;
--   * it could not be unique: two patients could be issued the same number with
--     nothing to stop it;
--   * so several screens SYNTHESISED one instead — `MRN-${did.slice(-6)}` — and
--     displayed it as the patient's real record number. That number matches no
--     wristband and no lab requisition, which is worse than showing nothing.
--
-- Uniqueness is PER HOSPITAL, not global. An MRN is issued by a hospital out of
-- its own sequence, so two hospitals legitimately use the same string. That is
-- not hypothetical here: "AC8884" is already issued to a patient at
-- 31e70a34-… and to another at 9f35c5d3-…. A global unique constraint would
-- reject the second one and be wrong to do so.

alter table public.profiles add column if not exists mrn text;

comment on column public.profiles.mrn is
  'Hospital-issued medical record number. Unique within a hospital, not across the platform — hospitals issue from independent sequences. NULL means none has been assigned; never synthesise one from a DID, it will not match the patient''s wristband.';

-- ─── Backfill from the identity credentials that already carry one ──────────
-- Matched through profiles.primary_did -> credentials.subject_did. Only rows
-- whose MRN is unambiguous are taken: if a DID somehow has two credentials
-- naming different MRNs, neither is guessed at.

with claimed as (
  select p.id                       as profile_id,
         min(c.claims->>'mrn')      as mrn,
         count(distinct c.claims->>'mrn') as variants
    from public.profiles p
    join public.credentials c on c.subject_did = p.primary_did
   where p.primary_did is not null
     and c.claims ? 'mrn'
     and nullif(trim(c.claims->>'mrn'), '') is not null
   group by p.id
)
update public.profiles p
   set mrn = claimed.mrn
  from claimed
 where p.id = claimed.profile_id
   and claimed.variants = 1
   and p.mrn is null;

-- ─── Per-hospital uniqueness ────────────────────────────────────────────────
-- Partial: rows with no MRN and rows with no hospital are excluded, so the
-- constraint never blocks a patient who simply has not been assigned one.
create unique index if not exists profiles_hospital_mrn_key
  on public.profiles (hospital_id, mrn)
  where mrn is not null and hospital_id is not null;

create index if not exists profiles_mrn_idx
  on public.profiles (mrn)
  where mrn is not null;

grant select, update on public.profiles to authenticated;
