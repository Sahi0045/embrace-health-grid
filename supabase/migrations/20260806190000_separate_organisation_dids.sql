-- ============================================================================
-- Distinguish organisation DIDs from person DIDs
-- ============================================================================
-- A hospital's DID was stored with owner_type = 'staff', because user_role has no
-- member for an organisation. Every query for clinicians therefore returned the
-- hospitals too, so the admin roster listed "Sunrise Clinic" and "test" as staff
-- members with an "Approve & Issue W3C DID" button beside them.
--
-- Adding a 'hospital' member to user_role would be wrong: that enum is the set of
-- roles a PERSON can hold, and it drives every RLS policy. A separate flag keeps
-- the two ideas apart.
-- ============================================================================

alter table public.dids
  add column if not exists is_organisation boolean not null default false;

comment on column public.dids.is_organisation is
  'True for a hospital or other institutional DID. Person-level queries (clinician directories, rosters) must exclude these.';

-- Backfill: an organisation DID is one with no owner_id, which is how the
-- onboard-hospital function writes them.
update public.dids
   set is_organisation = true
 where owner_id is null
   and did like 'did:hosp:org:%';

create index if not exists dids_is_organisation_idx on public.dids (is_organisation);

-- ─── Keep the clinician directory to actual people ──────────────────────────
-- dids_select_clinician_directory is what lets a patient find a doctor at another
-- hospital. Without the extra condition it also exposes every hospital DID as a
-- "clinician", which is how they reached the roster.
drop policy if exists dids_select_clinician_directory on public.dids;

create policy dids_select_clinician_directory on public.dids
  for select to authenticated
  using (
    owner_type in ('doctor', 'staff')
    and is_organisation = false
    and exists (
      select 1
        from public.hospitals h
       where h.hospital_id = public.dids.hospital_id
         and h.status = 'active'
    )
  );

-- Organisation DIDs stay readable: a patient must be able to resolve the issuer
-- named in their credential. Separate policy so the intent is explicit rather
-- than a side effect of the directory rule.
drop policy if exists dids_select_organisations on public.dids;

create policy dids_select_organisations on public.dids
  for select to authenticated
  using (is_organisation = true);
