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

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'admissions', 'beds', 'rooms', 'billing_accounts', 
    'admission_events', 'staff_schedule', 'nursing_notes', 'daily_checkups'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

alter table public.admissions replica identity full;
alter table public.beds replica identity full;
alter table public.rooms replica identity full;
alter table public.billing_accounts replica identity full;
alter table public.admission_events replica identity full;
alter table public.staff_schedule replica identity full;
alter table public.nursing_notes replica identity full;
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
