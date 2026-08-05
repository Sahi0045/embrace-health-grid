-- ============================================================================
-- Multi-tenancy Stage 1 — hospitals, super_admin, and the identity anchors
-- ============================================================================
-- The schema modelled a single implicit hospital: 42 tables, no tenant column
-- anywhere, and one hardcoded issuing authority
-- ("did:hosp:consortium:authority"). With more than one hospital on it, every
-- clinician could read every other hospital's directory.
--
-- This stage adds the tenant entity and the two anchors everything else keys
-- off (profiles.hospital_id, dids.hospital_id). It deliberately does NOT change
-- any policy yet — Stage 2 does that, so a broken policy is easy to bisect.
--
-- Helper functions go in `private`, with EXECUTE granted to authenticated. See
-- migration 003: revoking EXECUTE breaks every policy that calls them, because
-- policy expressions evaluate function privileges as the CALLING role.
-- ============================================================================

-- The super_admin role is added in migration 20260805095000: a new enum value
-- cannot be used in the transaction that creates it.

-- ─── 2. Hospitals ───────────────────────────────────────────────────────────
create table if not exists public.hospitals (
  hospital_id   uuid primary key default gen_random_uuid(),

  -- The hospital's DID. This becomes the issuing authority for credentials it
  -- grants its clinicians, replacing the single hardcoded consortium DID, so a
  -- credential can prove WHICH hospital vouched for a doctor.
  hospital_did  text not null unique,

  name          text not null,
  slug          text not null unique,
  city          text,
  country       text,
  contact_email text,

  status        text not null default 'active'
                check (status in ('active', 'suspended')),

  -- Proof the platform admitted this hospital, written by the register_hospital
  -- Anchor instruction. Null until the on-chain registration confirms, so a
  -- failed anchor is visible rather than silently assumed.
  onchain_tx    text,
  onchain_slot  bigint,

  -- The super_admin that onboarded it. No FK to profiles: an operator account
  -- may be removed later, and losing that reference must not delete a hospital.
  created_by    uuid,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.hospitals is
  'Tenants. Each hospital has its own DID, which is the issuing authority for credentials it grants its staff.';

create index if not exists hospitals_status_idx on public.hospitals (status);

-- ─── 3. Tenant anchors ──────────────────────────────────────────────────────
-- Nullable on purpose: a patient may hold records from several hospitals and is
-- not owned by any one of them, and existing rows must not be invalidated. For
-- staff, Stage 2 requires it to be set.
alter table public.profiles
  add column if not exists hospital_id uuid references public.hospitals (hospital_id);

alter table public.dids
  add column if not exists hospital_id uuid references public.hospitals (hospital_id);

create index if not exists profiles_hospital_idx on public.profiles (hospital_id);
create index if not exists dids_hospital_idx     on public.dids (hospital_id);

-- ─── 4. Seed a hospital for the existing data ───────────────────────────────
-- 13 profiles and 22 DIDs predate tenancy. Backfilling them into one hospital
-- keeps the app working through the migration; Stage 9 reseeds as two
-- hospitals to exercise isolation properly.
insert into public.hospitals (hospital_did, name, slug, city, country, status)
values (
  'did:hosp:org:apollo-consortium-general',
  'Apollo Consortium General',
  'apollo-consortium-general',
  'Bengaluru',
  'IN',
  'active'
)
on conflict (slug) do nothing;

update public.profiles
   set hospital_id = (select hospital_id from public.hospitals where slug = 'apollo-consortium-general')
 where hospital_id is null;

update public.dids
   set hospital_id = (select hospital_id from public.hospitals where slug = 'apollo-consortium-general')
 where hospital_id is null;

-- ─── 5. Tenancy helpers ─────────────────────────────────────────────────────

-- The caller's hospital. Null for a super_admin (they belong to the platform,
-- not a tenant) and for a patient with no hospital affiliation.
create or replace function private.current_user_hospital()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hospital_id from public.profiles where id = (select auth.uid());
$$;

-- Separate from current_user_role() so policies read as intent ("bypass tenant
-- scoping") rather than as a role comparison, and so the bypass is easy to
-- audit by grepping for one name.
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

-- True when the caller may act within the given hospital: their own, or any if
-- they are a super_admin.
create or replace function private.can_access_hospital(target_hospital_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    private.is_super_admin()
    or (
      target_hospital_id is not null
      and target_hospital_id = private.current_user_hospital()
    );
$$;

-- CREATE OR REPLACE resets grants, so re-apply them. Omitting this is what
-- broke every policy in migration 002.
grant execute on function private.current_user_hospital()   to authenticated, service_role;
grant execute on function private.is_super_admin()          to authenticated, service_role;
grant execute on function private.can_access_hospital(uuid) to authenticated, service_role;

-- ─── 6. RLS on hospitals ────────────────────────────────────────────────────
alter table public.hospitals enable row level security;

-- Any authenticated user may read the hospital directory: a patient needs to
-- see which hospital issued a credential, and verifying a DID means resolving
-- its issuer. These are organisations, not people — no PHI is involved.
create policy hospitals_select_authenticated on public.hospitals
  for select to authenticated
  using (true);

-- Only the platform may create, alter or suspend a hospital. No policy for
-- other roles: a hospital admin must not be able to mint a peer tenant or
-- un-suspend their own.
create policy hospitals_insert_super_admin on public.hospitals
  for insert to authenticated
  with check (private.is_super_admin());

create policy hospitals_update_super_admin on public.hospitals
  for update to authenticated
  using (private.is_super_admin())
  with check (private.is_super_admin());

-- Deliberately no DELETE policy. Suspension is a status change, so the record
-- of a hospital having been admitted survives; an auditor needs to see that
-- history rather than find an absence.
