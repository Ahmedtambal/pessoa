-- =====================================================
-- CREATE ADMIN USER FOR PESSOA AI
-- =====================================================
-- This script creates an admin user profile and sets up
-- the necessary permissions for accessing admin features.
--
-- INSTRUCTIONS:
-- 1. Replace the placeholders below with your actual values
-- 2. Run this script in your Supabase SQL editor
-- 3. The user will then have admin access to the application
-- =====================================================

-- =====================================================
-- STEP 1: REPLACE THESE PLACEHOLDER VALUES
-- =====================================================

-- Replace these values with your actual information:
-- YOUR_USER_ID_HERE: Get this from Supabase Auth > Users
-- YOUR_EMAIL_HERE: Your email address
-- YOUR_FULL_NAME_HERE: Your full name
-- YOUR_ORGANIZATION_HERE: Your organization name

DO $$
DECLARE
    user_id_to_make_admin UUID := 'YOUR_USER_ID_HERE'; -- Replace with your user ID
    user_email_to_make_admin TEXT := 'YOUR_EMAIL_HERE'; -- Replace with your email
    user_full_name TEXT := 'YOUR_FULL_NAME_HERE'; -- Replace with your full name
    user_organization TEXT := 'YOUR_ORGANIZATION_HERE'; -- Replace with your organization
BEGIN

    -- =====================================================
    -- STEP 2: CREATE ORGANIZATION IF NOT EXISTS
    -- =====================================================

    -- Create organization if it doesn't exist
    INSERT INTO organizations (name, created_at, updated_at)
    VALUES (user_organization, NOW(), NOW())
    ON CONFLICT (name) DO NOTHING;

    -- =====================================================
    -- STEP 3: CREATE/UPDATE PROFILE AS ADMIN
    -- =====================================================

    -- Insert or update the profile with admin role
    INSERT INTO profiles (
        id,
        full_name,
        organization_name,
        organization_id,
        role,
        marketing_consent,
        analytics_consent,
        cookie_consent_given,
        gdpr_data_processing,
        created_at,
        updated_at
    ) VALUES (
        user_id_to_make_admin,
        user_full_name,
        user_organization,
        (SELECT id FROM organizations WHERE name = user_organization),
        'ADMIN',
        false, -- marketing_consent
        false, -- analytics_consent
        false, -- cookie_consent_given
        false, -- gdpr_data_processing
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        organization_name = EXCLUDED.organization_name,
        organization_id = EXCLUDED.organization_id,
        role = 'ADMIN',
        updated_at = NOW();

    -- =====================================================
    -- STEP 4: LOG THE ADMIN CREATION
    -- =====================================================

    -- Log this admin creation in the audit log
    INSERT INTO audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_values,
        ip_address,
        created_at
    ) VALUES (
        user_id_to_make_admin,
        'ADMIN_ROLE_GRANTED',
        'profiles',
        user_id_to_make_admin,
        jsonb_build_object(
            'email', user_email_to_make_admin,
            'full_name', user_full_name,
            'organization', user_organization,
            'role', 'ADMIN',
            'granted_at', NOW()
        ),
        inet_client_addr(),
        NOW()
    );

    -- =====================================================
    -- STEP 5: VERIFY THE SETUP
    -- =====================================================

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Admin User Setup Complete!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'User ID: %', user_id_to_make_admin;
    RAISE NOTICE 'Email: %', user_email_to_make_admin;
    RAISE NOTICE 'Name: %', user_full_name;
    RAISE NOTICE 'Organization: %', user_organization;
    RAISE NOTICE 'Role: ADMIN';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Profile created/updated with admin role';
    RAISE NOTICE '✅ Organization created if needed';
    RAISE NOTICE '✅ Audit log entry created';
    RAISE NOTICE '';
    RAISE NOTICE 'You should now have admin access to:';
    RAISE NOTICE '- Settings page';
    RAISE NOTICE '- User management';
    RAISE NOTICE '- Organization settings';
    RAISE NOTICE '- All admin features';
    RAISE NOTICE '';
    RAISE NOTICE 'Please refresh your application to see the changes.';
    RAISE NOTICE '=================================================';

END $$;

-- =====================================================
-- STEP 6: VERIFY ADMIN ACCESS
-- =====================================================

-- Run this query to verify the admin setup worked
SELECT
    p.id,
    p.full_name,
    p.organization_name,
    p.role,
    u.email,
    CASE
        WHEN p.role = 'ADMIN' THEN '✅ ADMIN ACCESS GRANTED'
        WHEN p.role = 'MEMBER' THEN '❌ MEMBER ACCESS ONLY'
        ELSE '❓ UNKNOWN ROLE'
    END as status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email = 'YOUR_EMAIL_HERE'; -- Replace with your email

-- =====================================================
-- STEP 7: CHECK ADMIN FEATURES ACCESS
-- =====================================================

-- This query shows what admin features you now have access to
SELECT
    'Admin Features Access Check' as check_type,
    CASE
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = 'YOUR_USER_ID_HERE' AND role = 'ADMIN')
        THEN '✅ CAN ACCESS ADMIN FEATURES'
        ELSE '❌ CANNOT ACCESS ADMIN FEATURES'
    END as result;

-- =====================================================
-- TROUBLESHOOTING QUERIES
-- =====================================================

-- If you're still having issues, run these queries:

-- Check if profile exists
SELECT * FROM profiles WHERE id = 'YOUR_USER_ID_HERE';

-- Check user authentication
SELECT
    id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';

-- Check RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles'
AND schemaname = 'public';
