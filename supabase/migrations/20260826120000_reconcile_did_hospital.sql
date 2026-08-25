-- ============================================================================
-- Reconcile dids.hospital_id with the owner's actual hospital
-- ============================================================================
-- identity-ops `create-did` stamped `hospital_id: caller.hospitalId` — the
-- hospital of the ADMIN issuing the DID, not of the person it belongs to. So an
-- administrator at one hospital issuing DIDs for clinicians at another produced
-- DIDs attributed to the wrong tenant.
--
-- Verified in production before this migration: 7 of 10 clinicians had a DID
-- attributed to a different hospital than their profile, every one of them to
-- "KIMS" — including dr.smith, marcus.vance and sophia.martinez, whose profiles
-- all say Apollo General.
--
-- This is not cosmetic. dids.hospital_id is what getBookableDoctors filters on
-- and what several tenant policies scope by, so those clinicians were
-- simultaneously invisible to their own hospital's patients and visible to one
-- they do not work at. It is why an Apollo patient's booking list was empty.
--
-- profiles.hospital_id is authoritative: it is set from the employing hospital
-- at onboarding and is what the rest of the application treats as the person's
-- tenant. The DID follows it.
--
-- Only rows with an owner link are touched. A DID with no owner_id and no
-- matching profile cannot be reconciled from anything, so it is left alone
-- rather than guessed at — a signing identity assigned to the wrong hospital is
-- the defect being repaired here, not an acceptable outcome.

update public.dids d
   set hospital_id = p.hospital_id
  from public.profiles p
 where p.primary_did = d.did
   and p.hospital_id is not null
   and d.hospital_id is distinct from p.hospital_id;

-- Same, for DIDs linked by owner_id rather than primary_did.
update public.dids d
   set hospital_id = p.hospital_id
  from public.profiles p
 where d.owner_id = p.id
   and p.hospital_id is not null
   and d.hospital_id is distinct from p.hospital_id;

comment on column public.dids.hospital_id is
  'The hospital the SUBJECT belongs to — mirrors profiles.hospital_id, not the hospital of whoever issued the DID. Booking lists and tenant policies filter on this, so a wrong value both hides a clinician from their own hospital and exposes them to another.';
