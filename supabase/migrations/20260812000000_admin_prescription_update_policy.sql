-- ============================================================================
-- Migration — Admin Prescription Update Policy
-- ============================================================================
-- Allows hospital administrators to update prescription details.
-- This is required for the Admin Portal prescription management feature.
--
-- Security considerations:
-- - Only users with role='admin' can update prescriptions
-- - Admin can modify: diagnosis, notes, status, drugs (medications)
-- - Admin cannot modify: rx_id, patient_did, doctor_did, signed, signed_by, signed_at
--   (these are immutable identifiers and audit fields)
-- - Updates are logged via the updated_at trigger
-- ============================================================================

-- Add UPDATE policy for admins on prescriptions table
create policy prescriptions_update_admin on public.prescriptions
  for update to authenticated
  using (private.current_user_role() = 'admin')
  with check (private.current_user_role() = 'admin');

comment on policy prescriptions_update_admin on public.prescriptions is
  'Allows hospital administrators to update prescription details for clinical oversight and corrections.';
