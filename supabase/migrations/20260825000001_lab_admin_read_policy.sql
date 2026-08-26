-- ============================================================================
-- EMBRACE HEALTH GRID — LABORATORY ADMIN DASHBOARD READ ACCESS
-- Migration: 20260825000001_lab_admin_read_policy.sql
-- ============================================================================
-- Enables Hospital Administrators and Super Admins to view lab telemetry,
-- specimen pipeline, and diagnostic scanning metrics for operational management.
--
-- Access Control:
--   - SELECT only (read-only telemetry & queue tracking)
--   - Scoped to administrator's assigned hospital
--   - No write, modify, or delete access granted to administrators
-- ============================================================================

DO $$
BEGIN
  -- 1. Lab Orders Admin Read Policy
  DROP POLICY IF EXISTS lab_orders_select_admin ON public.lab_orders;
  CREATE POLICY lab_orders_select_admin ON public.lab_orders
    FOR SELECT TO authenticated
    USING (
      private.current_user_role() IN ('admin', 'super_admin')
      AND (
        hospital_id IS NULL 
        OR hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      )
    );

  -- 2. Lab Samples Admin Read Policy
  DROP POLICY IF EXISTS lab_samples_select_admin ON public.lab_samples;
  CREATE POLICY lab_samples_select_admin ON public.lab_samples
    FOR SELECT TO authenticated
    USING (
      private.current_user_role() IN ('admin', 'super_admin')
      AND (
        hospital_id IS NULL 
        OR hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      )
    );

  -- 3. Radiology Orders Admin Read Policy
  DROP POLICY IF EXISTS radiology_orders_select_admin ON public.radiology_orders;
  CREATE POLICY radiology_orders_select_admin ON public.radiology_orders
    FOR SELECT TO authenticated
    USING (
      private.current_user_role() IN ('admin', 'super_admin')
      AND (
        hospital_id IS NULL 
        OR hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      )
    );

  -- 4. Lab Results Admin Read Policy
  DROP POLICY IF EXISTS lab_results_select_admin ON public.lab_results;
  CREATE POLICY lab_results_select_admin ON public.lab_results
    FOR SELECT TO authenticated
    USING (
      private.current_user_role() IN ('admin', 'super_admin')
      AND (
        hospital_id IS NULL 
        OR hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
      )
    );
END $$;
