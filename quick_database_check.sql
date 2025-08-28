-- =====================================================
-- QUICK DATABASE CHECK
-- =====================================================
-- Run this to see what tables exist in your database
-- =====================================================

SELECT
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- CHECK SPECIFIC TABLES NEEDED BY THE APP
-- =====================================================

SELECT 'Checking required tables...' as status;

-- Check if organizations table exists
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'organizations'
    ) THEN '✅ organizations table exists'
    ELSE '❌ organizations table MISSING'
    END as organizations_status;

-- Check if profiles table exists
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN '✅ profiles table exists'
    ELSE '❌ profiles table MISSING'
    END as profiles_status;

-- Check if resumes table exists
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'resumes'
    ) THEN '✅ resumes table exists'
    ELSE '❌ resumes table MISSING'
    END as resumes_status;

-- =====================================================
-- CHECK SUPABASE AUTH SETUP
-- =====================================================

SELECT 'Checking Supabase Auth...' as auth_check;

-- Check if auth.users table has data
SELECT
    CASE WHEN EXISTS (SELECT 1 FROM auth.users LIMIT 1)
    THEN '✅ Users exist in auth.users'
    ELSE 'ℹ️ No users in auth.users yet'
    END as users_status;

-- Count of users
SELECT COUNT(*) as total_users_in_auth FROM auth.users;

-- =====================================================
-- SUMMARY
-- =====================================================

WITH table_check AS (
    SELECT
        COUNT(*) FILTER (WHERE table_name = 'organizations') as org_exists,
        COUNT(*) FILTER (WHERE table_name = 'profiles') as profiles_exists,
        COUNT(*) FILTER (WHERE table_name = 'resumes') as resumes_exists
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('organizations', 'profiles', 'resumes')
)
SELECT
    '=== DATABASE STATUS SUMMARY ===' as summary,
    CASE
        WHEN org_exists > 0 AND profiles_exists > 0 AND resumes_exists > 0
        THEN '✅ ALL REQUIRED TABLES EXIST - Ready to use!'
        WHEN org_exists = 0 OR profiles_exists = 0 OR resumes_exists = 0
        THEN '❌ MISSING TABLES - Run database setup scripts first'
        ELSE '❓ UNKNOWN STATUS'
    END as database_status,
    CASE
        WHEN org_exists > 0 THEN '✅ Organizations table ready'
        ELSE '❌ Organizations table missing'
    END as organizations,
    CASE
        WHEN profiles_exists > 0 THEN '✅ Profiles table ready'
        ELSE '❌ Profiles table missing'
    END as profiles,
    CASE
        WHEN resumes_exists > 0 THEN '✅ Resumes table ready'
        ELSE '❌ Resumes table missing'
    END as resumes
FROM table_check;
