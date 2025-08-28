-- Fix admin users function to work with proper permissions
-- This addresses the RPC permission errors you're seeing

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_users_with_profiles() CASCADE;

-- Create a new function that works with service role permissions
CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL
AS $$
    SELECT
        p.id,
        p.full_name,
        COALESCE(p.email, au.email) as email,
        p.organization_name,
        p.role,
        p.created_at
    FROM profiles p
    LEFT JOIN auth.users au ON p.id = au.id
    ORDER BY p.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO service_role;

-- Alternative function for when auth.users is not accessible
CREATE OR REPLACE FUNCTION get_profiles_only()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL
AS $$
    SELECT
        id,
        full_name,
        email,
        organization_name,
        role,
        created_at
    FROM profiles
    ORDER BY created_at DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_profiles_only() TO authenticated;
GRANT EXECUTE ON FUNCTION get_profiles_only() TO service_role;

-- Verify the functions work
SELECT 'Testing get_users_with_profiles function:' as test;
SELECT COUNT(*) as user_count FROM get_users_with_profiles();

SELECT 'Testing get_profiles_only function:' as test;
SELECT COUNT(*) as profile_count FROM get_profiles_only();

-- Show current grants
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('get_users_with_profiles', 'get_profiles_only');
