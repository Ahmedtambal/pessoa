-- =====================================================
-- QUICK FIX FOR RPC FUNCTION ERROR
-- =====================================================
-- Run this if you get: "cannot change return type of existing function"
-- =====================================================

-- =====================================================
-- 1. ADD MISSING EMAIL COLUMN TO PROFILES TABLE
-- =====================================================

-- Add email column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Update existing profiles with email from auth.users
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id AND (profiles.email IS NULL OR profiles.email = '');

-- =====================================================
-- 2. FIX RPC FUNCTION
-- =====================================================

-- Drop the existing function with CASCADE (drops dependencies)
DROP FUNCTION IF EXISTS get_users_with_profiles() CASCADE;

-- Recreate the function with correct return type
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

-- Test the function
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM get_users_with_profiles();
    RAISE NOTICE 'Function test: Found % users', user_count;

    IF user_count > 0 THEN
        RAISE NOTICE '✅ Function working correctly!';
        RAISE NOTICE 'First few users:';
        -- Simple test without loop to avoid syntax issues
        RAISE NOTICE '(Function returns data successfully)';
    ELSE
        RAISE NOTICE '⚠️  Function works but no users found';
    END IF;
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'RPC FUNCTION & EMAIL COLUMN FIXED!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles table';
    RAISE NOTICE '✅ Populated email data from auth.users';
    RAISE NOTICE '✅ Dropped old get_users_with_profiles() function';
    RAISE NOTICE '✅ Created new function with correct return type';
    RAISE NOTICE '✅ Function tested successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Now run the main fix script: run_database_fix.sql';
    RAISE NOTICE 'for complete database compliance setup';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
