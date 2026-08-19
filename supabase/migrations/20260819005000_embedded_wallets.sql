-- ============================================================================
-- Embedded wallets — server-held signing keys
-- ============================================================================
-- src/lib/embedded-wallet.server.ts reads and writes public.embedded_wallets,
-- but no migration ever created it, so every embedded-wallet call failed with
-- "Could not find the table". This adds it.
--
-- SECURITY — why there is no client-readable secret column:
--
-- encrypted_private_key is Solana signing key material. It is encrypted with
-- AES-256-GCM under MASTER_ENCRYPTION_KEY, which lives only in the server
-- environment and never in this database, so a database read alone does not
-- yield a usable key. It is still ciphertext + IV + auth tag, and the master key
-- is derived with a plain SHA-256 of the env var rather than a salted KDF, so a
-- low-entropy master key would be brute-forceable offline by anyone holding the
-- ciphertext. There is therefore no reason to let clients hold it.
--
-- The wallet code calls getSupabaseServerClient(), which authenticates with the
-- anon key plus the user's session cookie, so RLS applies to it exactly as it
-- would to the browser. A row-level policy permissive enough for the server to
-- read the key would be equally permissive for any authenticated user querying
-- this table directly. RLS is row-level, not column-level, so the split is done
-- with column privileges instead:
--
--   authenticated  may select only the non-secret columns, own hospital only
--   service_role   may do everything (bypasses RLS), and is the only principal
--                  that can read encrypted_private_key
--
-- Consequence for callers: reading or writing key material MUST go through a
-- service-role client. See getSupabaseServiceRoleClient() in supabase.server.ts.

create table if not exists public.embedded_wallets (
  wallet_id              uuid primary key default gen_random_uuid(),
  hospital_id            uuid not null references public.hospitals(hospital_id) on delete cascade,

  -- 'hospital' today. Kept open for per-user embedded wallets later.
  owner_type             text not null default 'hospital'
                         check (owner_type in ('hospital', 'user')),
  owner_id               uuid not null,

  public_key             text not null,
  encrypted_private_key  text not null,

  -- Lets keys be re-encrypted under a new master key without downtime: rows are
  -- migrated one version at a time rather than all at once.
  encryption_key_version int not null default 1,
  derivation_path        text not null default 'm/44''/501''/0''/0/0',

  is_active              boolean not null default true,
  last_used_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- One active wallet per owner. Partial unique index so deactivated keys can be
-- retained for verifying historical signatures.
create unique index if not exists embedded_wallets_active_owner_idx
  on public.embedded_wallets (hospital_id, owner_type, owner_id)
  where is_active;

create index if not exists embedded_wallets_hospital_idx
  on public.embedded_wallets (hospital_id);
create index if not exists embedded_wallets_pubkey_idx
  on public.embedded_wallets (public_key);

alter table public.embedded_wallets enable row level security;

-- ─── Privileges ─────────────────────────────────────────────────────────────
-- Start from nothing, then grant only the non-secret columns. encrypted_private_key
-- is deliberately absent from the grant, so even a permissive row policy cannot
-- expose it to authenticated.
revoke all on public.embedded_wallets from anon, authenticated;

grant select (
  wallet_id,
  hospital_id,
  owner_type,
  owner_id,
  public_key,
  encryption_key_version,
  is_active,
  last_used_at,
  created_at,
  updated_at
) on public.embedded_wallets to authenticated;

-- ─── Policies ───────────────────────────────────────────────────────────────
-- Staff may see THAT a wallet exists and its public key, to verify a signature
-- or show wallet status in the UI. Scoped to their own hospital: a public key is
-- not a secret, but which hospitals have signing wallets is not their business.
create policy embedded_wallets_select_staff on public.embedded_wallets
  for select to authenticated
  using (
    private.current_user_role() in ('doctor', 'staff', 'admin')
    and private.can_access_hospital(hospital_id)
  );

-- A super admin operates the platform and holds no hospital.
create policy embedded_wallets_select_super on public.embedded_wallets
  for select to authenticated
  using (private.is_super_admin());

-- No INSERT, UPDATE or DELETE policy for authenticated, and no grant either.
-- Wallet creation, rotation and deactivation are service_role operations
-- performed by the server, never by a client. A wallet must not be deletable at
-- all: signatures it produced have to stay verifiable, so retirement is
-- is_active = false.

create trigger embedded_wallets_touch_updated_at
  before update on public.embedded_wallets
  for each row execute function public.touch_updated_at();

comment on table public.embedded_wallets is
  'Server-held Solana signing keys. encrypted_private_key is readable only by service_role: it is excluded from the authenticated column grant, not merely gated by RLS. No DELETE — retire with is_active = false so past signatures stay verifiable.';

comment on column public.embedded_wallets.encrypted_private_key is
  'AES-256-GCM ciphertext under MASTER_ENCRYPTION_KEY as {iv,tag,encrypted} hex JSON. Never granted to anon or authenticated.';

-- ─── Guard ──────────────────────────────────────────────────────────────────
-- Fail the migration if encrypted_private_key is ever granted to a client role.
-- Without this the column privilege could be widened by a later migration and
-- nothing would notice.
do $$
declare
  leaked text;
begin
  select string_agg(distinct grantee, ', ')
    into leaked
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'embedded_wallets'
     and column_name = 'encrypted_private_key'
     and grantee in ('anon', 'authenticated');

  if leaked is not null then
    raise exception
      'embedded_wallets.encrypted_private_key must not be granted to client roles, found: %',
      leaked;
  end if;
end $$;
