-- ============================================================================
-- Migration 002 — Harden RLS helpers and optimise policy evaluation
-- ============================================================================
-- Addresses findings from `supabase db advisors`:
--
-- SECURITY (6 warnings)
--   The three RLS helper functions are SECURITY DEFINER but were also exposed
--   as PostgREST RPC endpoints (/rest/v1/rpc/...), executable by anon and
--   authenticated. They are internal plumbing for policy evaluation and must
--   not be callable directly — has_active_consent() in particular would let a
--   caller probe which patients have consented to a given clinician.
--   Fix: revoke EXECUTE from anon/authenticated. Policies still work because
--   policy evaluation runs as the table owner, not the caller.
--
-- PERFORMANCE (2 warnings, auth_rls_initplan)
--   `auth.uid() = id` re-evaluates auth.uid() per row. Wrapping it as
--   `(select auth.uid())` lets Postgres hoist it to an InitPlan — evaluated
--   once per statement instead of once per row.
--
-- The `multiple_permissive_policies` warnings are NOT addressed: they are a
-- deliberate design choice. Splitting "own rows" from "staff/consented access"
-- into separate policies keeps each one small and independently auditable.
-- Merging them into a single OR'd policy would save a policy evaluation but
-- make it far easier to introduce a hole while editing. Correctness over
-- micro-optimisation on the table holding PHI.
-- ============================================================================

-- ─── Lock down SECURITY DEFINER helpers ─────────────────────────────────────
-- Postgres grants EXECUTE to PUBLIC on new functions by default; revoke that
-- explicitly as well as from the two Supabase API roles.
revoke execute on function public.current_user_role()            from public, anon, authenticated;
revoke execute on function public.current_user_dids()            from public, anon, authenticated;
revoke execute on function public.has_active_consent(text)       from public, anon, authenticated;

-- service_role keeps EXECUTE so Edge Functions can reuse the same logic.
grant execute on function public.current_user_role()      to service_role;
grant execute on function public.current_user_dids()      to service_role;
grant execute on function public.has_active_consent(text) to service_role;

-- ─── Optimise auth.uid() evaluation in profiles policies ────────────────────
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = public.current_user_role()   -- still blocks self-promotion
  );

-- ─── Same optimisation inside the helper functions ──────────────────────────
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function public.current_user_dids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select did from public.dids where owner_id = (select auth.uid());
$$;

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
      and c.doctor_did in (
        select did from public.dids where owner_id = (select auth.uid())
      )
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > now())
  );
$$;

-- CREATE OR REPLACE resets grants to the default, so re-apply the lockdown.
revoke execute on function public.current_user_role()      from public, anon, authenticated;
revoke execute on function public.current_user_dids()      from public, anon, authenticated;
revoke execute on function public.has_active_consent(text) from public, anon, authenticated;
grant  execute on function public.current_user_role()      to service_role;
grant  execute on function public.current_user_dids()      to service_role;
grant  execute on function public.has_active_consent(text) to service_role;
