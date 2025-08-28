-- Debug Profile and Admin Issues
-- Run these queries in your Supabase SQL editor to diagnose the problem

-- =====================================================
-- 1. CHECK IF PROFILES TABLE EXISTS
-- =====================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'profiles';

-- =====================================================
-- 2. CHECK YOUR USER'S PROFILE RECORD
-- =====================================================

-- Replace 'your-user-id-here' with your actual user ID from authentication
-- You can find this in the browser console or Supabase dashboard

SELECT *
FROM profiles
WHERE id = 'your-user-id-here';

-- If you don't know your user ID, you can find it by email:
SELECT *
FROM profiles
WHERE id IN (
    SELECT id
    FROM auth.users
    WHERE email = 'your-email@example.com'
);

-- =====================================================
-- 3. CHECK ALL PROFILES IN YOUR ORGANIZATION
-- =====================================================

SELECT
    p.id,
    p.full_name,
    p.organization_name,
    p.role,
    u.email,
    u.created_at
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.organization_name, p.role DESC;

-- =====================================================
-- 4. CHECK IF YOU HAVE ADMIN PRIVILEGES
-- =====================================================

-- This should return your profile if you're an admin
SELECT *
FROM profiles
WHERE id = 'your-user-id-here'
AND role = 'ADMIN';

-- =====================================================
-- 5. CREATE/UPDATE YOUR PROFILE AS ADMIN (IF MISSING)
-- =====================================================

-- If you don't have a profile record, create one:
INSERT INTO profiles (id, full_name, organization_name, role)
VALUES (
    'your-user-id-here',
    'Your Full Name',
    'Your Organization Name',
    'ADMIN'
)
ON CONFLICT (id) DO UPDATE SET
    role = 'ADMIN',
    full_name = EXCLUDED.full_name,
    organization_name = EXCLUDED.organization_name;

-- =====================================================
-- 6. CHECK ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Check if RLS is enabled on profiles table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'profiles'
AND schemaname = 'public';

-- Check RLS policies on profiles table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
AND schemaname = 'public';

-- =====================================================
-- 7. TEST PROFILE QUERY DIRECTLY
-- =====================================================

-- Test the exact query used by the application
SELECT *
FROM profiles
WHERE id = 'your-user-id-here';

-- =====================================================
-- 8. CHECK AUTHENTICATION SETUP
-- =====================================================

-- Check if you have a valid session
SELECT
    id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- =====================================================
-- 9. ENABLE DETAILED LOGGING (TEMPORARY)
-- =====================================================

-- Enable temporary logging to see what's happening
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create a temporary policy that logs all access (remove after debugging)
CREATE OR REPLACE FUNCTION log_profile_access()
RETURNS TRIGGER AS $$
BEGIN
    RAISE LOG 'Profile access by user: %, table: %, operation: %',
             auth.uid(),
             TG_TABLE_NAME,
             TG_OP;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create temporary trigger to log all profile access
DROP TRIGGER IF EXISTS log_profile_access_trigger ON profiles;
CREATE TRIGGER log_profile_access_trigger
    BEFORE SELECT OR INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION log_profile_access();

-- =====================================================
-- 10. QUICK FIXES
-- =====================================================

-- If you're still having issues, try these quick fixes:

-- 1. Disable RLS temporarily for testing (RE-ENABLE AFTER TESTING!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Ensure you have a profile record
INSERT INTO profiles (id, full_name, organization_name, role)
VALUES (
    'your-user-id-here',
    'Admin User',
    'Your Organization',
    'ADMIN'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Re-enable RLS after testing
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Clean up temporary logging
DROP TRIGGER IF EXISTS log_profile_access_trigger ON profiles;
DROP FUNCTION IF EXISTS log_profile_access();

-- =====================================================
-- 11. COMPLETE DIAGNOSTIC QUERY
-- =====================================================

-- Run this comprehensive diagnostic query
WITH user_info AS (
    SELECT
        id,
        email,
        created_at as user_created,
        last_sign_in_at
    FROM auth.users
    WHERE email = 'your-email@example.com'
),
profile_info AS (
    SELECT
        id,
        full_name,
        organization_name,
        role,
        created_at as profile_created
    FROM profiles
    WHERE id IN (SELECT id FROM user_info)
),
rls_info AS (
    SELECT
        tablename,
        rowsecurity as rls_enabled
    FROM pg_tables
    WHERE tablename = 'profiles'
    AND schemaname = 'public'
),
policy_info AS (
    SELECT
        COUNT(*) as policy_count
    FROM pg_policies
    WHERE tablename = 'profiles'
    AND schemaname = 'public'
)
SELECT
    u.id,
    u.email,
    u.user_created,
    u.last_sign_in_at,
    p.full_name,
    p.organization_name,
    p.role,
    p.profile_created,
    r.rls_enabled,
    pol.policy_count,
    CASE
        WHEN p.role = 'ADMIN' THEN 'HAS_ADMIN_ACCESS'
        WHEN p.role IS NULL THEN 'NO_PROFILE_RECORD'
        WHEN p.role = 'MEMBER' THEN 'HAS_MEMBER_ACCESS_ONLY'
        ELSE 'UNKNOWN_ROLE'
    END as access_status
FROM user_info u
LEFT JOIN profile_info p ON u.id = p.id
CROSS JOIN rls_info r
CROSS JOIN policy_info pol;
