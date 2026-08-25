-- ============================================================================
-- Sign consent decisions with the patient's own key
-- ============================================================================
-- A consent grant is the security boundary of this system, and until now the
-- only evidence a patient approved one was a `status` column that a privileged
-- write could set. Nothing was signed by the patient.
--
-- Every DID now carries a server-held Ed25519 key (20260826100000), so the
-- decision can carry a signature the patient's published public key verifies —
-- without the patient installing a wallet or holding a seed phrase.
--
-- Custodial, and the schema says so: the platform holds the key, so this proves
-- "the platform recorded this decision under the patient's key at this time",
-- not "only the patient could have produced it". That is still a large step up
-- from a mutable status column, because the signed payload commits to the
-- grant, the doctor, the resource, the decision and the timestamp together —
-- so none of them can be altered afterwards without invalidating it.

alter table public.consents
  add column if not exists patient_signature   text,
  add column if not exists signed_payload      text,
  add column if not exists signing_public_key  text;

comment on column public.consents.signed_payload is
  'The exact canonical string that was signed. Stored verbatim so verification never has to guess how it was built — a reconstructed payload that differs by one byte fails, and that failure would look like tampering.';

comment on column public.consents.patient_signature is
  'base64 Ed25519 signature over signed_payload, made with the patient DID''s key.';

comment on column public.consents.signing_public_key is
  'The public key used, captured at signing time. Recorded here rather than read from dids.public_key at verification time, so a later key rotation cannot silently invalidate historical signatures.';

grant select on public.consents to authenticated;
