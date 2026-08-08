-- ============================================================================
-- Migration 007 — staff_requests
-- ============================================================================
-- The last table needed by the "views over existing tables" group. Everything
-- else in that group maps onto tables that already exist; this one had no
-- Postgres equivalent.
--
-- Staff raise requests (equipment, leave, transfer, support) which an
-- administrator resolves.
-- ============================================================================

create type staff_request_status as enum ('pending', 'approved', 'rejected', 'completed');

create table public.staff_requests (
  request_id   text primary key,
  staff_id     uuid not null references public.profiles(id) on delete cascade,
  request_type text not null,
  subject      text not null,
  details      text,
  status       staff_request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null,

  -- A resolved request must record when it was resolved.
  constraint staff_requests_resolved_has_timestamp
    check (status = 'pending' or resolved_at is not null)
);

create index staff_requests_staff_idx  on public.staff_requests (staff_id, created_at desc);
create index staff_requests_status_idx on public.staff_requests (status) where status = 'pending';

alter table public.staff_requests enable row level security;

-- A staff member sees their own requests.
create policy staff_requests_select_own on public.staff_requests
  for select to authenticated
  using (staff_id = (select auth.uid()));

-- Admins see all of them, since they are the ones resolving.
create policy staff_requests_select_admin on public.staff_requests
  for select to authenticated
  using (private.current_user_role() = 'admin');

-- Staff raise requests only in their own name.
create policy staff_requests_insert_own on public.staff_requests
  for insert to authenticated
  with check (staff_id = (select auth.uid()));

-- Only an admin may approve or reject. Without this split a requester could
-- approve their own request.
create policy staff_requests_update_admin on public.staff_requests
  for update to authenticated
  using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');
