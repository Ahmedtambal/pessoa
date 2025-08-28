-- =====================================================
-- DIAGNOSTIC CHECK FOR PESSOA AI ISSUES
-- =====================================================
-- Run this to diagnose what might be wrong
-- =====================================================

-- =====================================================
-- 1. CHECK TABLE EXISTENCE
-- =====================================================

DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== TABLE EXISTENCE CHECK ===';

    -- Check organizations table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
    INTO table_exists;
    RAISE NOTICE 'organizations table: %', CASE WHEN table_exists THEN 'EXISTS' ELSE 'MISSING' END;

    -- Check profiles table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
    INTO table_exists;
    RAISE NOTICE 'profiles table: %', CASE WHEN table_exists THEN 'EXISTS' ELSE 'MISSING' END;

    -- Check resumes table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes')
    INTO table_exists;
    RAISE NOTICE 'resumes table: %', CASE WHEN table_exists THEN 'EXISTS' ELSE 'MISSING' END;
END $$;

-- =====================================================
-- 2. CHECK TABLE STRUCTURE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TABLE STRUCTURE CHECK ===';

    -- Check profiles table columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE NOTICE 'profiles table columns:';
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        ORDER BY ordinal_position;
    ELSE
        RAISE NOTICE 'profiles table: DOES NOT EXIST';
    END IF;

    -- Check resumes table columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        RAISE NOTICE 'resumes table columns:';
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'resumes'
        ORDER BY ordinal_position;
    ELSE
        RAISE NOTICE 'resumes table: DOES NOT EXIST';
    END IF;
END $$;

-- =====================================================
-- 3. CHECK RPC FUNCTIONS
-- =====================================================

DO $$
DECLARE
    function_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RPC FUNCTIONS CHECK ===';

    -- Check get_users_with_profiles function
    SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_with_profiles')
    INTO function_exists;
    RAISE NOTICE 'get_users_with_profiles function: %', CASE WHEN function_exists THEN 'EXISTS' ELSE 'MISSING' END;

    -- Check delete_organization_data function
    SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'delete_organization_data')
    INTO function_exists;
    RAISE NOTICE 'delete_organization_data function: %', CASE WHEN function_exists THEN 'EXISTS' ELSE 'MISSING' END;
END $$;

-- =====================================================
-- 4. CHECK DATA COUNTS
-- =====================================================

DO $$
DECLARE
    user_count INTEGER;
    resume_count INTEGER;
    org_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DATA COUNTS ===';

    -- Count profiles
    SELECT COUNT(*) INTO user_count FROM profiles;
    RAISE NOTICE 'Total profiles: %', user_count;

    -- Count organizations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
        SELECT COUNT(*) INTO org_count FROM organizations;
        RAISE NOTICE 'Total organizations: %', org_count;
    ELSE
        RAISE NOTICE 'organizations table: MISSING';
    END IF;

    -- Count resumes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        SELECT COUNT(*) INTO resume_count FROM resumes;
        RAISE NOTICE 'Total resumes: %', resume_count;
    ELSE
        RAISE NOTICE 'resumes table: MISSING';
    END IF;
END $$;

-- =====================================================
-- 5. CHECK ADMIN USERS
-- =====================================================

DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== ADMIN USERS CHECK ===';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'ADMIN';
        RAISE NOTICE 'Admin users: %', admin_count;

        IF admin_count > 0 THEN
            RAISE NOTICE 'Admin users found:';
            SELECT id, full_name, email, organization_name
            FROM profiles
            WHERE role = 'ADMIN';
        END IF;
    ELSE
        RAISE NOTICE 'profiles table: MISSING - cannot check admins';
    END IF;
END $$;

-- =====================================================
-- 6. TEST RPC FUNCTION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RPC FUNCTION TEST ===';

    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_with_profiles') THEN
        BEGIN
            -- Test the RPC function
            SELECT COUNT(*) FROM get_users_with_profiles();
            RAISE NOTICE 'get_users_with_profiles(): WORKS';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'get_users_with_profiles(): ERROR - %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'get_users_with_profiles(): FUNCTION MISSING';
    END IF;
END $$;

-- =====================================================
-- 7. CHECK RLS POLICIES
-- =====================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RLS POLICIES CHECK ===';

    -- Check policies on profiles table
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'profiles';
    RAISE NOTICE 'profiles table policies: %', policy_count;

    -- Check policies on resumes table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes') THEN
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies
        WHERE tablename = 'resumes';
        RAISE NOTICE 'resumes table policies: %', policy_count;
    END IF;
END $$;

-- =====================================================
-- 8. FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSTIC SUMMARY ===';
    RAISE NOTICE 'If you see MISSING tables or functions above, run:';
    RAISE NOTICE 'run_database_fix.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'If tables exist but functions are missing, run:';
    RAISE NOTICE 'run_database_fix.sql (sections 2-4)';
    RAISE NOTICE '';
    RAISE NOTICE 'If everything looks good but issues persist:';
    RAISE NOTICE '• Check backend logs for specific errors';
    RAISE NOTICE '• Verify OpenAI API key is set';
    RAISE NOTICE '• Check Supabase service role key';
    RAISE NOTICE '• Restart your backend server';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
