-- Enable RLS and create policies for public.audit_logs
-- This policy set assumes admin status is recorded in public.profiles.role = 'ADMIN'
-- and that the JWT subject claim (sub) contains the user's id.

-- Enable pgcrypto if not present (migration 0001 already created table and extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable row level security
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke broad permissions from public (optional safety)
REVOKE ALL ON public.audit_logs FROM public;

-- Policy: allow users to SELECT their own audit rows
CREATE POLICY audit_allow_own_select ON public.audit_logs
  FOR SELECT
  USING (user_id::text = current_setting('jwt.claims.sub', true));

-- Policy: allow admin users to SELECT all audit rows. Admins are detected via
-- the profiles table: profiles.id = jwt.sub and profiles.role = 'ADMIN'.
CREATE POLICY audit_allow_admin_select ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (current_setting('jwt.claims.sub', true))::uuid
        AND p.role = 'ADMIN'
    )
  );

-- Note: We intentionally do NOT create INSERT/UPDATE/DELETE policies for
-- non-service clients. The Supabase service-role key bypasses RLS so server
-- code can continue to insert audit rows. Browser/anon keys will be blocked
-- from writing by default when RLS is enabled.
