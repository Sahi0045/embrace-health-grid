-- ============================================================================
-- Embedded wallets for DIDs (patients and clinicians)
-- ============================================================================
-- Every DID in this system carries a PLACEHOLDER public key: `pk_` followed by a
-- random uuid fragment, written by identity-ops create-did. Verified against
-- production — 0 of 40 DIDs hold a real key. So a "decentralized identity" here
-- currently has no key material behind it: nothing can be signed as a patient,
-- and nothing signed can be verified against them.
--
-- The fix is a server-held keypair per DID, encrypted at rest with
-- MASTER_ENCRYPTION_KEY — the same pattern public.embedded_wallets already uses
-- for hospital signing keys. The patient installs nothing and cannot lose
-- anything, which is the point: a seed phrase is an unacceptable failure mode
-- for a medical record.
--
-- NOT the approach that was already stubbed in src/lib/embedded-wallet.server.ts.
-- PatientWalletService.derivePatientWallet() derived the keypair as
--
--     Keypair.fromSeed(sha256(`${patientDid}|${hospitalId}|health-grid`))
--
-- Every input there is public: the DID is printed on the patient's emergency QR
-- code, hospital_id is readable by any authenticated user, and the third term is
-- a literal in the source. Anyone who scanned a patient's QR could regenerate
-- that patient's private key. It was never called; it is deleted rather than
-- wired up.
--
-- ─── Why a new owner column ────────────────────────────────────────────────
-- owner_id is `uuid` and owner_type allows only ('hospital','user'), so neither
-- can address a DID — DIDs are text, and 12 of 40 have no profile row to point
-- at. owner_did carries the reference directly.

alter table public.embedded_wallets
  add column if not exists owner_did text references public.dids(did) on delete cascade;

-- owner_id stays required for the existing owner kinds, but a DID-owned wallet
-- has no uuid to put there.
alter table public.embedded_wallets alter column owner_id drop not null;

alter table public.embedded_wallets drop constraint if exists embedded_wallets_owner_type_check;
alter table public.embedded_wallets
  add constraint embedded_wallets_owner_type_check
  check (owner_type in ('hospital', 'user', 'did'));

alter table public.embedded_wallets drop constraint if exists embedded_wallets_owner_ref_check;
alter table public.embedded_wallets
  add constraint embedded_wallets_owner_ref_check
  check (
    (owner_type = 'did'  and owner_did is not null and owner_id is null) or
    (owner_type <> 'did' and owner_id  is not null and owner_did is null)
  );

-- One active wallet per DID. Partial, so a rotated-out key is retained and
-- historical signatures stay verifiable.
create unique index if not exists embedded_wallets_active_did_idx
  on public.embedded_wallets (owner_did)
  where is_active and owner_did is not null;

-- owner_did is not a secret; encrypted_private_key remains ungranted.
grant select (owner_did) on public.embedded_wallets to authenticated;

comment on column public.embedded_wallets.owner_did is
  'The DID this signing key belongs to, for owner_type = ''did''. Server-held and custodial by design: the platform can sign as this subject, so every signing operation must be audited. Never derive the key from the DID — it is public.';

comment on column public.dids.public_key is
  'Solana public key (base58) once an embedded wallet is provisioned. Rows still holding a `pk_...` value are placeholders from before 20260826100000 and have no key material behind them.';
