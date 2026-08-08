-- ============================================================================
-- Migration 001 — Core identity + clinical slice
-- ============================================================================
-- Vertical slice to establish the RLS pattern before extending to all
-- 41 legacy namespaces:
--
--   profiles         identity, linked 1:1 to auth.users
--   dids             DID registry (application domain — Supabase has no DID concept)
--   credentials      Verifiable Credentials issued against a DID
--   consents         patient -> staff access grants (drives clinical RLS)
--   medical_records  PHI, readable only by owner or a consented clinician
--
-- Design decisions:
--   * Relational with typed columns and real foreign keys (not a JSON blob
--     store). RLS can only express "patient sees own rows" if the policy can
--     reference actual columns.
--   * No field-level encryption. PHI relies on RLS + Supabase at-rest
--     encryption. Ciphertext columns cannot be filtered, sorted or joined,
--     which would force query logic back into an application server.
--   * Deny by default: RLS is enabled everywhere and write policies are
--     deliberately omitted where only service_role (Edge Functions) should write.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────
-- Legacy data contains four distinct roles: patient(86) staff(56) doctor(10)
-- admin(6). 'doctor' is modelled explicitly rather than folded into 'staff'
-- because clinical policies differ.
create type user_role as enum ('patient', 'doctor', 'staff', 'admin');

create type did_status as enum ('active', 'suspended', 'revoked');

create type consent_status as enum ('active', 'revoked', 'expired', 'pending');

-- ─── profiles ───────────────────────────────────────────────────────────────
-- One row per authenticated user. auth.users holds credentials (Supabase Auth
-- owns password hashing); this table holds domain identity.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  role        user_role not null,
  primary_did text,                                  -- FK added after dids exists
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Domain identity, 1:1 with auth.users. Passwords live in auth.users, never here.';

-- ─── dids ───────────────────────────────────────────────────────────────────
create table public.dids (
  did              text primary key,
  owner_id         uuid references public.profiles(id) on delete set null,
  owner_name       text not null,
  owner_type       user_role not null,
  public_key       text not null,
  controller       text not null,
  status           did_status not null default 'active',
  service_endpoint text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index dids_owner_id_idx on public.dids (owner_id);
create index dids_status_idx   on public.dids (status);

alter table public.profiles
  add constraint profiles_primary_did_fkey
  foreign key (primary_did) references public.dids(did) on delete set null;

-- ─── credentials ────────────────────────────────────────────────────────────
-- Verifiable Credentials. `signature` is produced by an Edge Function holding
-- the issuer private key — never client-side, hence no client write policy.
create table public.credentials (
  id            text primary key,
  credential_type text not null,
  issuer        text not null,
  subject_did   text not null references public.dids(did) on delete cascade,
  claims        jsonb not null default '{}'::jsonb,
  signature     text not null,
  status        text not null default 'valid',
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz
);

create index credentials_subject_did_idx on public.credentials (subject_did);

-- ─── consents ───────────────────────────────────────────────────────────────
-- The authorisation edge that clinical RLS depends on: a clinician may read a
-- patient's records only while an active, unexpired consent row exists.
create table public.consents (
  grant_id    text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  doctor_did  text not null references public.dids(did) on delete cascade,
  resource    text not null,
  status      consent_status not null default 'active',
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  constraint consents_no_self_grant check (patient_did <> doctor_did)
);

create index consents_patient_did_idx on public.consents (patient_did);
create index consents_doctor_did_idx  on public.consents (doctor_did);
-- Supports the RLS lookup path: doctor + status + expiry.
create index consents_active_idx on public.consents (doctor_did, status)
  where status = 'active';

-- ─── medical_records ────────────────────────────────────────────────────────
create table public.medical_records (
  record_id   text primary key,
  patient_did text not null references public.dids(did) on delete cascade,
  title       text not null,
  record_type text not null,
  content     text,
  author_did  text references public.dids(did) on delete set null,
  author_name text,
  content_hash text,                                 -- sha256, anchored on-chain
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index medical_records_patient_did_idx on public.medical_records (patient_did);

-- ============================================================================
-- Helper functions for RLS
-- ============================================================================
-- SECURITY DEFINER + a pinned search_path: these read tables that are
-- themselves under RLS, so they must not recurse through policy evaluation.

-- Current user's role, read from profiles.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

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

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.dids            enable row level security;
alter table public.credentials     enable row level security;
alter table public.consents        enable row level security;
alter table public.medical_records enable row level security;

-- ─── profiles ───────────────────────────────────────────────────────────────
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Staff/doctors/admins may see the roster. Split from the self-access policy so
-- a patient can never read another patient's profile.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.current_user_role() in ('doctor', 'staff', 'admin'));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());  -- no self-promotion

-- No INSERT policy: profile creation happens via trigger / service_role.
-- No DELETE policy: cascades from auth.users.

-- ─── dids ───────────────────────────────────────────────────────────────────
-- DIDs and public keys are public by design — resolution must work for
-- verification. Restricted to authenticated to avoid an open enumeration surface.
create policy dids_select_authenticated on public.dids
  for select to authenticated
  using (true);

-- Writes go through service_role (DID issuance is a controlled operation).

-- ─── credentials ────────────────────────────────────────────────────────────
create policy credentials_select_own on public.credentials
  for select to authenticated
  using (subject_did in (select public.current_user_dids()));

create policy credentials_select_staff on public.credentials
  for select to authenticated
  using (public.current_user_role() in ('doctor', 'staff', 'admin'));

-- No client write policies: signing requires the issuer key (Edge Function only).

-- ─── consents ───────────────────────────────────────────────────────────────
-- Patient sees grants they issued; clinician sees grants naming them.
create policy consents_select_involved on public.consents
  for select to authenticated
  using (
    patient_did in (select public.current_user_dids())
    or doctor_did in (select public.current_user_dids())
  );

-- Only the patient may grant consent, and only from a DID they own.
create policy consents_insert_patient on public.consents
  for insert to authenticated
  with check (patient_did in (select public.current_user_dids()));

-- Only the patient may revoke.
create policy consents_update_patient on public.consents
  for update to authenticated
  using (patient_did in (select public.current_user_dids()))
  with check (patient_did in (select public.current_user_dids()));

-- ─── medical_records ────────────────────────────────────────────────────────
-- The core isolation guarantee: own records, or records of a patient who has
-- granted this clinician an active consent.
create policy medical_records_select_own on public.medical_records
  for select to authenticated
  using (patient_did in (select public.current_user_dids()));

create policy medical_records_select_consented on public.medical_records
  for select to authenticated
  using (public.has_active_consent(patient_did));

-- Admins deliberately get NO blanket read policy here. Break-glass access
-- should be an audited Edge Function, not an implicit RLS bypass.

-- Clinicians may author records for patients who have consented.
create policy medical_records_insert_clinician on public.medical_records
  for insert to authenticated
  with check (
    public.current_user_role() in ('doctor', 'staff')
    and public.has_active_consent(patient_did)
  );

-- No UPDATE/DELETE policies: clinical records are append-only from the client.
-- Amendments are a service_role operation so they leave an audit trail.

-- ─── updated_at maintenance ─────────────────────────────────────────────────
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

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger dids_touch_updated_at
  before update on public.dids
  for each row execute function public.touch_updated_at();

create trigger medical_records_touch_updated_at
  before update on public.medical_records
  for each row execute function public.touch_updated_at();
