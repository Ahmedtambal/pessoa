-- =====================================================
-- VERIFY ADMIN STATUS AND TROUBLESHOOT ISSUES
-- =====================================================
-- Run this script to check your current admin status
-- and identify any issues preventing admin access.
-- =====================================================

-- =====================================================
-- STEP 1: CHECK YOUR CURRENT PROFILE STATUS
-- =====================================================

-- Replace 'your-email@example.com' with your actual email
SELECT
    '=== YOUR PROFILE STATUS ===' as section,
    CASE
        WHEN p.id IS NOT NULL THEN '✅ PROFILE EXISTS'
        ELSE '❌ NO PROFILE FOUND'
    END as profile_status,
    p.id as user_id,
    p.full_name,
    p.organization_name,
    p.role,
    u.email,
    p.created_at as profile_created,
    u.created_at as user_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'your-email@example.com'; -- Replace with your email

-- =====================================================
-- STEP 2: CHECK ADMIN ROLE STATUS
-- =====================================================

SELECT
    '=== ADMIN ACCESS CHECK ===' as section,
    CASE
        WHEN p.role = 'ADMIN' THEN '✅ YOU HAVE ADMIN ACCESS'
        WHEN p.role = 'MEMBER' THEN '❌ YOU HAVE MEMBER ACCESS ONLY'
        WHEN p.role IS NULL THEN '❌ NO ROLE ASSIGNED'
        ELSE '❓ UNKNOWN ROLE: ' || p.role
    END as admin_status,
    CASE
        WHEN p.role = 'ADMIN' THEN 'You can access Settings and all admin features'
        WHEN p.role = 'MEMBER' THEN 'You can only access basic features'
        ELSE 'Contact administrator to set up your role'
    END as access_level
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'your-email@example.com';

-- =====================================================
-- STEP 3: CHECK DATABASE STRUCTURE
-- =====================================================

SELECT
    '=== DATABASE STRUCTURE CHECK ===' as section,
    table_name,
    CASE
        WHEN table_name = 'profiles' THEN '✅ REQUIRED TABLE EXISTS'
        WHEN table_name = 'resumes' THEN '✅ REQUIRED TABLE EXISTS'
        WHEN table_name = 'audit_log' THEN '✅ COMPLIANCE TABLE EXISTS'
        WHEN table_name = 'manual_review_requests' THEN '✅ COMPLIANCE TABLE EXISTS'
        ELSE 'ℹ️ TABLE EXISTS'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'resumes', 'audit_log', 'manual_review_requests', 'organizations')
ORDER BY table_name;

-- =====================================================
-- STEP 4: CHECK ROW LEVEL SECURITY
-- =====================================================

SELECT
    '=== ROW LEVEL SECURITY CHECK ===' as section,
    tablename as table_name,
    rowsecurity as rls_enabled,
    CASE
        WHEN rowsecurity THEN '✅ RLS ENABLED (GOOD)'
        ELSE '❌ RLS DISABLED (SECURITY RISK)'
    END as security_status
FROM pg_tables
WHERE tablename IN ('profiles', 'resumes')
AND schemaname = 'public';

-- =====================================================
-- STEP 5: CHECK RLS POLICIES
-- =====================================================

SELECT
    '=== RLS POLICIES CHECK ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    CASE
        WHEN policyname LIKE '%own%' THEN '✅ USER CAN ACCESS OWN DATA'
        WHEN policyname LIKE '%insert%' THEN '✅ USER CAN CREATE RECORDS'
        ELSE 'ℹ️ POLICY EXISTS'
    END as policy_status
FROM pg_policies
WHERE tablename IN ('profiles', 'resumes')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 6: CHECK APPLICATION FEATURES ACCESS
-- =====================================================

SELECT
    '=== FEATURE ACCESS CHECK ===' as section,
    CASE
        WHEN p.role = 'ADMIN' THEN '✅ CAN ACCESS: Settings, User Management, Organization Settings'
        WHEN p.role = 'MEMBER' THEN '✅ CAN ACCESS: Resume Upload, CV Analysis, Profile Management'
        ELSE '❌ LIMITED ACCESS: Basic features only'
    END as feature_access,
    CASE
        WHEN p.role = 'ADMIN' THEN 'Full administrative access to all features'
        WHEN p.role = 'MEMBER' THEN 'Standard user access with compliance features'
        ELSE 'Contact administrator for proper access setup'
    END as access_description
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'your-email@example.com';

-- =====================================================
-- STEP 7: QUICK FIXES (IF NEEDED)
-- =====================================================

-- If you don't have a profile, run this:
-- INSERT INTO profiles (id, full_name, organization_name, role)
-- SELECT
--     id,
--     'Your Name', -- Replace with your name
--     'Your Organization', -- Replace with your organization
--     'ADMIN' -- Change to 'MEMBER' if you don't want admin access
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- AND id NOT IN (SELECT id FROM profiles);

-- If you have a profile but wrong role, run this:
-- UPDATE profiles
-- SET role = 'ADMIN' -- Change to 'MEMBER' if you don't want admin access
-- WHERE id IN (
--     SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );

-- =====================================================
-- STEP 8: COMPREHENSIVE DIAGNOSTIC SUMMARY
-- =====================================================

WITH user_check AS (
    SELECT
        u.id,
        u.email,
        p.full_name,
        p.organization_name,
        p.role,
        CASE
            WHEN p.id IS NOT NULL THEN '✅ PROFILE EXISTS'
            ELSE '❌ NO PROFILE FOUND'
        END as profile_status,
        CASE
            WHEN p.role = 'ADMIN' THEN '✅ ADMIN ACCESS'
            WHEN p.role = 'MEMBER' THEN '✅ MEMBER ACCESS'
            ELSE '❌ NO ROLE ASSIGNED'
        END as role_status
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.email = 'your-email@example.com'
),
table_check AS (
    SELECT COUNT(*) as required_tables_exist
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('profiles', 'resumes')
),
rls_check AS (
    SELECT COUNT(*) as rls_enabled_tables
    FROM pg_tables
    WHERE tablename IN ('profiles', 'resumes')
    AND schemaname = 'public'
    AND rowsecurity = true
)
SELECT
    '=== COMPREHENSIVE DIAGNOSTIC SUMMARY ===' as diagnostic_summary,
    uc.email,
    uc.profile_status,
    uc.role_status,
    CASE
        WHEN uc.role = 'ADMIN' THEN '🎉 FULL ADMIN ACCESS - All features available'
        WHEN uc.role = 'MEMBER' THEN '✅ STANDARD ACCESS - Basic features available'
        ELSE '❌ ACCESS ISSUES - Contact administrator or run setup scripts'
    END as overall_status,
    CASE
        WHEN tc.required_tables_exist = 2 THEN '✅ DATABASE STRUCTURE OK'
        ELSE '❌ DATABASE ISSUES - Run database setup scripts'
    END as database_status,
    CASE
        WHEN rc.rls_enabled_tables = 2 THEN '✅ SECURITY OK'
        ELSE '❌ SECURITY ISSUES - RLS not properly configured'
    END as security_status
FROM user_check uc
CROSS JOIN table_check tc
CROSS JOIN rls_check rc;
