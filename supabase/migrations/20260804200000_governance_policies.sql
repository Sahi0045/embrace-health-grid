-- ============================================================================
-- Migration 010 — governance_policies
-- ============================================================================
-- The last table the admin surface needs. Governance policies are the written
-- rules the platform claims to enforce (consent verification, retention,
-- break-glass conditions), displayed and edited by administrators.
--
-- These are organisational documents, not PHI. They are readable by any
-- authenticated staff member — a clinician should be able to look up the
-- consent policy that governs their own access — but only an admin may change
-- one, since editing a policy silently changes what the organisation claims to
-- do.
-- ============================================================================

create type policy_status as enum ('active', 'draft', 'retired');

create table public.governance_policies (
  policy_id   text primary key,
  name        text not null,
  category    text,
  status      policy_status not null default 'draft',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

create index governance_policies_status_idx on public.governance_policies (status);

alter table public.governance_policies enable row level security;

-- Any authenticated user may read the rules that govern them.
create policy governance_policies_select on public.governance_policies
  for select to authenticated
  using (true);

-- Only admins may author or amend a policy.
create policy governance_policies_insert_admin on public.governance_policies
  for insert to authenticated
  with check (private.current_user_role() = 'admin');

create policy governance_policies_update_admin on public.governance_policies
  for update to authenticated
  using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');

-- No DELETE policy: a policy that once applied should be retired, not erased,
-- so the historical record of what was in force survives.

create trigger governance_policies_touch_updated_at
  before update on public.governance_policies
  for each row execute function public.touch_updated_at();
