-- =====================================================
-- EMERGENCY FIX FOR ADMIN USERS LIST
-- =====================================================
-- Run this if all other fixes fail
-- =====================================================

-- Step 1: Add email column if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Simple direct query (no function needed)
-- Test by running this manually:
-- SELECT id, full_name, email, organization_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 10;

-- Step 3: If you still need the function, use this simple version:
DROP FUNCTION IF EXISTS get_users_with_profiles() CASCADE;

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
    RETURN QUERY SELECT p.id, p.full_name, p.email, p.organization_name, p.role, p.created_at FROM profiles p ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Test the fix
SELECT COUNT(*) as user_count FROM get_users_with_profiles();

-- =====================================================
-- MANUAL TEST (run this after the script)
-- =====================================================
-- If the function doesn't work, use this direct query in your backend code:
-- SELECT id, full_name, email, organization_name, role, created_at FROM profiles ORDER BY created_at DESC;

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'EMERGENCY FIX APPLIED!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles table';
    RAISE NOTICE '✅ Created simple get_users_with_profiles() function';
    RAISE NOTICE '';
    RAISE NOTICE 'TEST: SELECT COUNT(*) FROM get_users_with_profiles();';
    RAISE NOTICE '';
    RAISE NOTICE 'If function fails, use direct query:';
    RAISE NOTICE 'SELECT id, full_name, email, organization_name, role, created_at FROM profiles;';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
