-- =====================================================
-- SIMPLE DATABASE FIX FOR PESSOA AI
-- =====================================================
-- Run this to fix the most common issues
-- =====================================================

-- =====================================================
-- 1. ADD EMAIL COLUMN
-- =====================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id AND (profiles.email IS NULL OR profiles.email = '');

-- =====================================================
-- 2. FIX RPC FUNCTION
-- =====================================================

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

-- =====================================================
-- 3. ADD PROFILE_ID TO RESUMES
-- =====================================================

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

UPDATE resumes
SET profile_id = user_id
WHERE profile_id IS NULL;

-- =====================================================
-- 4. BASIC RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- =====================================================
-- 5. QUICK TEST
-- =====================================================

SELECT COUNT(*) as user_count FROM get_users_with_profiles();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM get_users_with_profiles();

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'SIMPLE DATABASE FIX COMPLETE!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles';
    RAISE NOTICE '✅ Created get_users_with_profiles() function';
    RAISE NOTICE '✅ Fixed resumes table structure';
    RAISE NOTICE '✅ Updated admin policies';
    RAISE NOTICE '✅ Found % users in system', user_count;
    RAISE NOTICE '';
    RAISE NOTICE 'TEST THESE FEATURES:';
    RAISE NOTICE '• Admin Settings → Users list';
    RAISE NOTICE '• Resume upload';
    RAISE NOTICE '• CV comparison';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
