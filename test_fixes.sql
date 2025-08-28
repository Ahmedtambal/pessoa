-- =====================================================
-- TEST YOUR FIXES
-- =====================================================
-- Run this to verify the emergency fix worked
-- =====================================================

-- =====================================================
-- 1. TEST ADMIN USERS FUNCTION
-- =====================================================

DO $$
DECLARE
    user_count INTEGER;
BEGIN
    RAISE NOTICE '=== TESTING ADMIN USERS FUNCTION ===';

    SELECT COUNT(*) INTO user_count FROM get_users_with_profiles();

    IF user_count > 0 THEN
        RAISE NOTICE '✅ get_users_with_profiles() works! Found % users', user_count;
        RAISE NOTICE '✅ Admin Settings → Users should now work';
    ELSE
        RAISE NOTICE '⚠️  Function works but no users found';
        RAISE NOTICE '   This is normal for a new system';
    END IF;
END $$;

-- =====================================================
-- 2. TEST EMAIL COLUMN EXISTS
-- =====================================================

DO $$
DECLARE
    email_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TESTING EMAIL COLUMN ===';

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'email'
    ) INTO email_exists;

    IF email_exists THEN
        RAISE NOTICE '✅ Email column exists in profiles table';
    ELSE
        RAISE NOTICE '❌ Email column missing - run emergency_fix.sql again';
    END IF;
END $$;

-- =====================================================
-- 3. TEST BASIC TABLES EXIST
-- =====================================================

DO $$
DECLARE
    profiles_exists BOOLEAN;
    resumes_exists BOOLEAN;
    organizations_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TESTING BASIC TABLES ===';

    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') INTO profiles_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') INTO resumes_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') INTO organizations_exists;

    RAISE NOTICE 'Profiles table: %', CASE WHEN profiles_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE 'Resumes table: %', CASE WHEN resumes_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE 'Organizations table: %', CASE WHEN organizations_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
END $$;

-- =====================================================
-- 4. SAMPLE USER DATA
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== SAMPLE USER DATA ===';

    RAISE NOTICE 'First 3 users:';
    FOR user_record IN SELECT * FROM get_users_with_profiles() LIMIT 3 LOOP
        RAISE NOTICE '- % (%): % at %', user_record.full_name, user_record.email, user_record.role, user_record.organization_name;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not get sample data (this is normal if no users exist)';
END $$;

-- =====================================================
-- 5. WHAT TO TEST NEXT
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== WHAT TO TEST IN YOUR APP ===';
    RAISE NOTICE '';
    RAISE NOTICE '1. Admin Settings → Users List';
    RAISE NOTICE '   - Should show user list with emails';
    RAISE NOTICE '   - Should allow role changes';
    RAISE NOTICE '';
    RAISE NOTICE '2. Resume Upload';
    RAISE NOTICE '   - Upload a PDF/DOCX file';
    RAISE NOTICE '   - Should complete without errors';
    RAISE NOTICE '';
    RAISE NOTICE '3. CV Comparison';
    RAISE NOTICE '   - Upload multiple CVs';
    RAISE NOTICE '   - Should generate comparison analysis';
    RAISE NOTICE '';
    RAISE NOTICE '4. Profile Management';
    RAISE NOTICE '   - Click profile button';
    RAISE NOTICE '   - Should open settings modal';
    RAISE NOTICE '   - Danger Zone should work';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'IF ANYTHING FAILS, RUN: run_database_fix.sql';
    RAISE NOTICE 'FOR COMPLETE COMPLIANCE SETUP';
    RAISE NOTICE '=================================================';
END $$;
