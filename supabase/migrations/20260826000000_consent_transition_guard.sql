-- ============================================================================
-- Consent: make the update rules actually enforceable
-- ============================================================================
-- `consents_revoke_patient` was created as a PERMISSIVE policy alongside
-- `consents_update_patient`. Permissive policies OR together — both the USING
-- and the WITH CHECK clauses — so its constraints never bound anything: any
-- update that satisfied `consents_update_patient` was admitted regardless.
--
-- And `consents_update_patient` is the weaker of the two. The 20260803180000
-- version carried `with check (patient_did in (...))`; the 20260820120000
-- rewrite dropped the WITH CHECK entirely, leaving only USING. A row the
-- patient owns could therefore be updated to ANY value of ANY column: a revoked
-- grant flipped back to `active`, `approved_at` written directly, or
-- `doctor_did` repointed at a different clinician — silently re-granting access
-- the patient believes they withdrew.
--
-- No UI path does this today. That is not the point: consent is the security
-- boundary of this system, and "no client currently sends that request" is not
-- a control. PostgREST exposes the table directly, so the request is one curl
-- away from any authenticated patient.
--
-- Two mechanisms, because one is not sufficient:
--
--   1. A RESTRICTIVE policy for the properties expressible in RLS (ownership,
--      legal target states, matching timestamp). Restrictive policies AND with
--      the permissive set, so this one genuinely constrains.
--
--   2. A trigger for the properties RLS CANNOT express. A WITH CHECK clause
--      sees only the NEW row — it has no access to OLD — so "you may not move a
--      revoked grant back to active" and "doctor_did is immutable" are simply
--      not statable as a policy. They need a trigger, and a trigger also covers
--      service_role, which bypasses RLS altogether.

-- ─── 1. Fold the dead permissive policy into a restrictive one ──────────────

drop policy if exists consents_revoke_patient on public.consents;

drop policy if exists consents_update_patient_guard on public.consents;
create policy consents_update_patient_guard on public.consents
  as restrictive
  for update to authenticated
  using (patient_did in (select private.current_user_dids()))
  with check (
    -- Re-asserted in WITH CHECK, not just USING: without it the patient could
    -- hand the row to someone else's DID on the way out.
    patient_did in (select private.current_user_dids())
    -- An update is a decision. `pending` is not a decision, so it is not a
    -- legal destination — a row can only be left pending by not touching it.
    and status in ('active', 'revoked', 'rejected', 'expired')
    -- Each terminal state must carry its own timestamp. medical_records_select_doctor
    -- and prescriptions_select_doctor both test `approved_at is not null`, so an
    -- active grant without one looks granted and opens nothing.
    and (status <> 'active'   or approved_at is not null)
    and (status <> 'revoked'  or revoked_at  is not null)
    and (status <> 'rejected' or rejected_at is not null)
  );

-- `consents_update_patient` stays as the permissive grant that admits the
-- patient at all; the restrictive policy above is what bounds it.

-- ─── 2. Transition and immutability guard ───────────────────────────────────

create or replace function private.consents_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Identity is fixed at insert. Repointing any of these turns an audited
  -- decision into a different one while keeping its grant_id and history.
  if new.grant_id    is distinct from old.grant_id
  or new.patient_did is distinct from old.patient_did
  or new.doctor_did  is distinct from old.doctor_did
  or new.resource    is distinct from old.resource then
    raise exception 'consents: grant_id, patient_did, doctor_did and resource are immutable'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    -- Terminal states are terminal. Allowing revoked -> active is the whole
    -- reason this trigger exists: it would let a patient (or a bug) restore
    -- access that the audit trail records as withdrawn.
    if old.status in ('revoked', 'rejected', 'expired') then
      raise exception 'consents: % is terminal and cannot be changed to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if old.status = 'pending' and new.status not in ('active', 'rejected', 'expired') then
      raise exception 'consents: a pending request may only become active, rejected or expired'
        using errcode = 'check_violation';
    end if;

    if old.status = 'active' and new.status not in ('revoked', 'expired') then
      raise exception 'consents: an active grant may only become revoked or expired'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Timestamps are the audit trail. Rewriting one rewrites when a decision was
  -- made; they may be set once, from null.
  if old.approved_at is not null and new.approved_at is distinct from old.approved_at then
    raise exception 'consents: approved_at cannot be rewritten' using errcode = 'check_violation';
  end if;
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'consents: revoked_at cannot be rewritten' using errcode = 'check_violation';
  end if;
  if old.rejected_at is not null and new.rejected_at is distinct from old.rejected_at then
    raise exception 'consents: rejected_at cannot be rewritten' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function private.consents_guard_update() is
  'Enforces the consent state machine. Lives in a trigger rather than an RLS policy because a WITH CHECK clause cannot see OLD, so no policy can express "revoked may not return to active". Applies to service_role too, which bypasses RLS.';

drop trigger if exists consents_guard_update on public.consents;
create trigger consents_guard_update
  before update on public.consents
  for each row execute function private.consents_guard_update();

-- ─── 3. Remove the policy that references an unreachable state ──────────────
-- consents_insert_doctor requires `status = 'requested'`, but every insert path
-- writes 'pending' (consents_insert_clinician_request) or 'active'
-- (consents_insert_patient). It admits nothing, and leaving it in place implies
-- 'requested' is part of the lifecycle when nothing reads or writes it.
drop policy if exists consents_insert_doctor on public.consents;
