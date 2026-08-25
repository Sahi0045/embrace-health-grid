-- ============================================================================
-- Staff profile fields
-- ============================================================================
-- The staff profile page offers Department, Role/Title and Specializations for
-- editing, but `profiles` has no columns for any of them: updateProfile() drops
-- the three silently and still reports "Profile updated successfully!". The
-- fields were declared on CurrentUser with a TODO saying exactly this.
--
-- Note what is deliberately NOT reused here: `profiles.role` is the AUTH role
-- (patient | doctor | staff | admin | super_admin) and decides what RLS lets a
-- caller read. The profile dialog's "Role / Title" means a job title — "Senior
-- Cardiologist" — which is a different thing entirely. It gets its own `title`
-- column; `role` stays out of reach of self-service editing, as
-- profiles_update_own already enforces.

alter table public.profiles add column if not exists department      text;
alter table public.profiles add column if not exists title           text;
alter table public.profiles add column if not exists specializations text[] not null default '{}';
alter table public.profiles add column if not exists employee_id     text;
alter table public.profiles add column if not exists join_date       date;

comment on column public.profiles.title is
  'Job title shown on the profile ("Senior Cardiologist"). NOT an authorization field — public.profiles.role is, and is not self-editable.';

comment on column public.profiles.specializations is
  'Clinical specialisations. Defaults to an empty array rather than null so the UI never has to distinguish "none" from "not loaded".';

comment on column public.profiles.employee_id is
  'Hospital-issued staff number. Free text: formats vary per tenant.';

-- The existing policies already cover these columns (profiles_update_own is
-- row-scoped and re-asserts `role = private.current_user_role()`, so widening
-- the row does not widen what a user may change about their own role). Grants
-- on public.profiles are table-level, so new columns inherit them; re-asserted
-- here because a column added later is easy to forget.
grant select, update on public.profiles to authenticated;
