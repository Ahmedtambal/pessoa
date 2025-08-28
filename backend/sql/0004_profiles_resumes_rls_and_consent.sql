-- Add consent/tos columns to profiles and enable RLS for profiles and resumes

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add consent and tos columns
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz NULL;

-- Enable RLS
ALTER TABLE IF EXISTS public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.resumes FROM public;
REVOKE ALL ON public.profiles FROM public;

-- Resumes owner policy
DROP POLICY IF EXISTS resumes_owner_full ON public.resumes;
CREATE POLICY resumes_owner_full ON public.resumes
  FOR ALL
  USING (profile_id::text = current_setting('jwt.claims.sub', true))
  WITH CHECK (profile_id::text = current_setting('jwt.claims.sub', true));

-- Resumes admin select
DROP POLICY IF EXISTS resumes_admin_select ON public.resumes;
CREATE POLICY resumes_admin_select ON public.resumes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (current_setting('jwt.claims.sub', true))::uuid
        AND p.role = 'ADMIN'
    )
  );

-- Profiles owner policy
DROP POLICY IF EXISTS profiles_own_rw ON public.profiles;
CREATE POLICY profiles_own_rw ON public.profiles
  FOR ALL
  USING (id::text = current_setting('jwt.claims.sub', true))
  WITH CHECK (id::text = current_setting('jwt.claims.sub', true));

-- Profiles admin select
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = (current_setting('jwt.claims.sub', true))::uuid
        AND p2.role = 'ADMIN'
    )
  );
