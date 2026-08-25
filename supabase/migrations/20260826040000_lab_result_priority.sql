-- ============================================================================
-- Lab orders: carry the clinician's priority through to the row
-- ============================================================================
-- The order form offers STAT / Urgent / Routine. `orderLab()` in src/lib/api.ts
-- declared the parameter `_priority` and never forwarded it; `orderLabTest`
-- accepted only `{patientDid, testName}`; and `public.lab_results` has no
-- priority column for it to land in. So a STAT order was placed as an ordinary
-- one — and staff.labs.tsx then rendered `lab.priority || "routine"`, displaying
-- it back to the ordering clinician with a ROUTINE badge.
--
-- A stat troponin downgraded to routine and shown as routine is the worst shape
-- this bug can take: the clinician has no signal that their urgency was lost.
--
-- The vocabulary matches public.lab_orders (20260819000000), which already uses
-- 'stat' | 'urgent' | 'routine', so the two tables agree.

alter table public.lab_results
  add column if not exists priority text not null default 'routine';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lab_results_priority_check'
  ) then
    alter table public.lab_results
      add constraint lab_results_priority_check
      check (priority in ('stat', 'urgent', 'routine'));
  end if;
end $$;

create index if not exists lab_results_priority_idx
  on public.lab_results (priority)
  where priority <> 'routine';

comment on column public.lab_results.priority is
  'Clinical urgency chosen by the ordering clinician: stat | urgent | routine. Defaults to routine, which is the correct default ONLY because it is also the least-urgent value — never default an unknown urgency upward or downward from what was actually selected.';

-- Table-level grants cover new columns; re-asserted because a column added later
-- is easy to forget.
grant select on public.lab_results to authenticated;
