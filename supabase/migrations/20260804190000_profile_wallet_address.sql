-- ============================================================================
-- Migration 009 — profiles.wallet_address
-- ============================================================================
-- Required by the identity-ops wallet-link operation.
--
-- The wallet address is stored as profile metadata, NOT as an authentication
-- factor. Possession of a Solana keypair proves control of that keypair; it
-- does not establish who the person is. Authentication remains Supabase Auth,
-- and RLS continues to key off auth.uid().
--
-- The address is public information on-chain, so it carries no secret. It is
-- readable under the same policies as the rest of the profile.
-- ============================================================================

alter table public.profiles
  add column if not exists wallet_address text;

-- One wallet per profile: two accounts sharing an address would make on-chain
-- attribution ambiguous.
create unique index if not exists profiles_wallet_address_key
  on public.profiles (wallet_address)
  where wallet_address is not null;

comment on column public.profiles.wallet_address is
  'Solana wallet address. Profile metadata only — never an authentication factor.';
