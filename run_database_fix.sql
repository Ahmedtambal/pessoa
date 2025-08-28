-- =====================================================
-- QUICK FIX SCRIPT FOR PESSOA AI ISSUES
-- =====================================================
-- Run this in your Supabase SQL Editor to fix all issues
-- =====================================================

-- =====================================================
-- 1. EMERGENCY FIXES (Run these first)
-- =====================================================

-- Add email column to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Update existing profiles with email from auth.users
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id AND (profiles.email IS NULL OR profiles.email = '');

-- Add profile_id column to resumes if missing
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Update existing records to set profile_id from user_id
UPDATE resumes
SET profile_id = user_id
WHERE profile_id IS NULL;

-- =====================================================
-- 2. CREATE RPC FUNCTIONS
-- =====================================================

-- Drop existing function if it exists (with CASCADE to drop dependencies)
DROP FUNCTION IF EXISTS get_users_with_profiles() CASCADE;

-- Create the RPC function for admin users list
CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE(
    id UUID,
    full_name VARCHAR(255),
    email VARCHAR(255),
    organization_name VARCHAR(255),
    role VARCHAR(20),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.email,
        p.organization_name,
        p.role,
        p.created_at
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS delete_organization_data(TEXT) CASCADE;

-- Create organization delete function
CREATE OR REPLACE FUNCTION delete_organization_data(org_name_param TEXT)
RETURNS TEXT AS $$
DECLARE
    org_id UUID;
    deleted_users INTEGER := 0;
    deleted_profiles INTEGER := 0;
BEGIN
    -- Get organization ID
    SELECT id INTO org_id
    FROM organizations
    WHERE name = org_name_param;

    IF org_id IS NULL THEN
        RETURN 'Organization not found';
    END IF;

    -- Delete all resumes for users in this organization
    DELETE FROM resumes
    WHERE user_id IN (
        SELECT p.id
        FROM profiles p
        WHERE p.organization_id = org_id
    );

    -- Delete profiles (this will cascade to related data)
    DELETE FROM profiles
    WHERE organization_id = org_id;

    -- Delete the organization itself
    DELETE FROM organizations
    WHERE id = org_id;

    RETURN 'Organization and all associated data deleted successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. ADD MISSING INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- =====================================================
-- 4. FIX RLS POLICIES FOR ADMIN ACCESS
-- =====================================================

-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- Allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- Allow admins to view all resumes
DROP POLICY IF EXISTS "Admins can view all resumes" ON resumes;
CREATE POLICY "Admins can view all resumes"
ON resumes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- =====================================================
-- 5. HEALTH CHECK FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_system_health() CASCADE;

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE(
    component TEXT,
    status TEXT,
    details TEXT,
    last_checked TIMESTAMPTZ
) AS $$
BEGIN
    -- Check if required tables exist and have data
    RETURN QUERY
    SELECT
        'organizations'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
             THEN 'healthy' ELSE 'missing' END as status,
        CASE WHEN EXISTS (SELECT 1 FROM organizations) THEN 'Has data' ELSE 'Empty' END as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'profiles'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
             THEN 'healthy' ELSE 'missing' END as status,
        CASE WHEN EXISTS (SELECT 1 FROM profiles) THEN 'Has ' || (SELECT COUNT(*) FROM profiles)::TEXT || ' users' ELSE 'Empty' END as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'resumes'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes')
             THEN 'healthy' ELSE 'missing' END as status,
        CASE WHEN EXISTS (SELECT 1 FROM resumes) THEN 'Has ' || (SELECT COUNT(*) FROM resumes)::TEXT || ' resumes' ELSE 'Empty' END as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'rpc_functions'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_with_profiles')
             THEN 'healthy' ELSE 'missing' END as status,
        'Admin functions'::TEXT as details,
        NOW() as last_checked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RUN HEALTH CHECK
-- =====================================================

SELECT * FROM get_system_health();

-- =====================================================
-- 7. FIX COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'QUICK DATABASE FIX COMPLETE!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles';
    RAISE NOTICE '✅ Fixed resumes table (profile_id)';
    RAISE NOTICE '✅ Created get_users_with_profiles() RPC function';
    RAISE NOTICE '✅ Created delete_organization_data() function';
    RAISE NOTICE '✅ Added performance indexes';
    RAISE NOTICE '✅ Updated admin RLS policies';
    RAISE NOTICE '✅ Created health check function';
    RAISE NOTICE '';
    RAISE NOTICE 'FIXED ISSUES:';
    RAISE NOTICE '• Admin users list should now work';
    RAISE NOTICE '• Resume upload should now work';
    RAISE NOTICE '• CV comparison should work';
    RAISE NOTICE '• Profile deletion should work';
    RAISE NOTICE '';
    RAISE NOTICE 'TEST THESE FEATURES:';
    RAISE NOTICE '1. Admin Settings → Users list';
    RAISE NOTICE '2. Resume upload';
    RAISE NOTICE '3. CV comparison';
    RAISE NOTICE '4. Profile deletion in Danger Zone';
    RAISE NOTICE '';
    RAISE NOTICE 'If issues persist, check:';
    RAISE NOTICE '• OpenAI API key in backend settings';
    RAISE NOTICE '• Supabase service role key';
    RAISE NOTICE '• Frontend environment variables';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
