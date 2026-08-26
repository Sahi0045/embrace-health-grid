-- ============================================================================
-- Backfill nfc_cards.hospital_id
-- ============================================================================
-- The identity-ops `issue-nfc` handler runs on the service-role client, so RLS
-- did not bound it, and it checked only that the caller was staff or admin. Two
-- consequences, both now fixed in supabase/functions/identity-ops/index.ts:
--
--   1. No tenant check on the subject, so an administrator at one hospital could
--      mint an identity card for another hospital's patient (and `revoke-nfc`
--      could revoke one, by card id alone).
--   2. The INSERT omitted hospital_id entirely, so every card issued through
--      that path is tenant-less. nfc_cards' SELECT policy is hospital-scoped,
--      which means those cards are invisible to EVERY hospital administrator —
--      including the one who issued them. They cannot be listed, audited or
--      revoked through the console.
--
-- Verified in production: 2 of 14 rows have hospital_id IS NULL.
--
-- The owning hospital is recoverable: a card names a patient DID, and
-- public.dids records which hospital issued that DID.

update public.nfc_cards c
   set hospital_id = d.hospital_id
  from public.dids d
 where c.hospital_id is null
   and c.patient_did = d.did
   and d.hospital_id is not null;

-- Any row still NULL names a DID that no longer exists or that itself has no
-- hospital. Those stay NULL rather than being assigned a guessed tenant — an
-- identity card attributed to the wrong hospital is worse than one that is
-- visible to none.

comment on column public.nfc_cards.hospital_id is
  'Owning hospital, stamped at issue time. Required for the hospital-scoped SELECT policy to see the card at all — a NULL here makes the card invisible to every administrator. Rows predating the identity-ops tenant fix were backfilled from public.dids.';
