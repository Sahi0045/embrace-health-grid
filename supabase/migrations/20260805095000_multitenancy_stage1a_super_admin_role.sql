-- ============================================================================
-- Multi-tenancy Stage 1a — add the super_admin role
-- ============================================================================
-- Isolated in its own migration because Postgres refuses to use a new enum
-- value in the same transaction that adds it (SQLSTATE 55P04). The value has to
-- be committed before private.is_super_admin() can compare against it.
-- ============================================================================

alter type public.user_role add value if not exists 'super_admin';
