-- ============================================================================
-- Patient Master Realtime Enablement
-- ============================================================================
-- Enables Supabase Realtime on Patient Master related tables so admin and
-- staff portals can display live updates of patient admissions, transfers,
-- bed/room status, and billing changes.
--
-- Tables enabled:
--   - admissions: patient admission/discharge/transfer events
--   - beds: bed availability and occupancy changes
--   - rooms: room occupancy and status changes
--   - billing_accounts: patient billing updates
--   - admission_events: admission lifecycle audit trail
--
-- RLS is already enforced on these tables:
--   - Admins see all in their hospital
--   - Staff see relevant records for their hospital
--   - Patients see their own records
--   - Realtime respects these policies automatically
--
-- REPLICA IDENTITY FULL is used on tables where UPDATE events need old row
-- values (e.g., to detect status transitions or occupancy changes).
-- ============================================================================

-- ─── Add tables to realtime publication ──────────────────────────────────────

-- Admissions: patient admission/discharge/transfer lifecycle
alter publication supabase_realtime add table if not exists public.admissions;
alter table public.admissions replica identity full;

-- Beds: occupancy and status changes
alter publication supabase_realtime add table if not exists public.beds;
alter table public.beds replica identity full;

-- Rooms: occupancy and status changes
alter publication supabase_realtime add table if not exists public.rooms;
alter table public.rooms replica identity full;

-- Billing: charges, payments, outstanding balance updates
alter publication supabase_realtime add table if not exists public.billing_accounts;
alter table public.billing_accounts replica identity full;

-- Admission events: audit trail of all admission state changes
alter publication supabase_realtime add table if not exists public.admission_events;
alter table public.admission_events replica identity full;

-- ─── Optional: Staff schedule for availability tracking ──────────────────────
-- Enable live updates on staff schedule so doctor availability status updates
-- in real-time when shifts are confirmed/rejected
alter publication supabase_realtime add table if not exists public.staff_schedule;
alter table public.staff_schedule replica identity full;

-- ─── Optional: Nursing notes and checkups for live clinical updates ──────────
-- Enable realtime on clinical observation tables so staff can see live updates
-- during patient care
alter publication supabase_realtime add table if not exists public.nursing_notes;
alter table public.nursing_notes replica identity full;

alter publication supabase_realtime add table if not exists public.daily_checkups;
alter table public.daily_checkups replica identity full;

-- ─── Realtime subscription helpers documentation ───────────────────────────
-- The following patterns should be used in React/client code to subscribe to
-- Patient Master changes:
--
-- Admin Portal (all admissions in hospital):
--   useTableRefresh('admissions', loadAdmissions)
--
-- Staff Portal (admissions affecting assigned ward):
--   useTableRefresh('admissions', loadWardAdmissions)
--   useTableRefresh('beds', loadBedStatus)
--
-- Patient Portal (own admission updates):
--   useTableRefresh('admissions', loadMyAdmission)
--   useTableRefresh('billing_accounts', updateMyBilling)
--
-- All subscriptions automatically enforce RLS; changes only push to clients
-- that have SELECT permission on the affected rows.
