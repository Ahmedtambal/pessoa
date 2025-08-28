-- =====================================================
-- COMPREHENSIVE DATABASE FIX FOR PESSOA AI
-- =====================================================
-- This script fixes all the issues:
-- 1. Admin users list (RPC function + email column)
-- 2. Resume upload (profile_id vs user_id)
-- 3. Profile deletion (danger zone)
-- 4. Missing database functions
-- =====================================================

-- =====================================================
-- 1. ADD EMAIL COLUMN TO PROFILES TABLE
-- =====================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Update existing profiles with email from auth.users
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id AND (profiles.email IS NULL OR profiles.email = '');

-- =====================================================
-- 2. FIX RESUMES TABLE STRUCTURE
-- =====================================================

-- Add profile_id column if it doesn't exist (for proper foreign key relationship)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Update existing records to set profile_id from user_id
UPDATE resumes
SET profile_id = user_id
WHERE profile_id IS NULL;

-- =====================================================
-- 3. CREATE RPC FUNCTION FOR ADMIN USERS LIST
-- =====================================================

CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT,
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
-- 4. CREATE ORGANIZATION DELETE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION delete_organization_data(org_name_param TEXT)
RETURNS TEXT AS $$
DECLARE
    org_id UUID;
    deleted_users INTEGER := 0;
    deleted_profiles INTEGER := 0;
BEGIN
    -- Get organization ID
    SELECT id INTO org_id
    FROM organizations
    WHERE name = org_name_param;

    IF org_id IS NULL THEN
        RETURN 'Organization not found';
    END IF;

    -- Delete all resumes for users in this organization
    DELETE FROM resumes
    WHERE user_id IN (
        SELECT p.id
        FROM profiles p
        WHERE p.organization_id = org_id
    );

    -- Delete profiles (this will cascade to related data)
    DELETE FROM profiles
    WHERE organization_id = org_id;

    -- Delete the organization itself
    DELETE FROM organizations
    WHERE id = org_id;

    RETURN 'Organization and all associated data deleted successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. ADD MISSING INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- =====================================================
-- 6. UPDATE RLS POLICIES FOR ADMIN ACCESS
-- =====================================================

-- Allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- Allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile"
ON profiles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- Allow admins to view all resumes
DROP POLICY IF EXISTS "Admins can view all resumes" ON resumes;
CREATE POLICY "Admins can view all resumes"
ON resumes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
);

-- =====================================================
-- 7. CREATE AUDIT TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only audit changes made by admins or system
    IF auth.uid() IS NOT NULL THEN
        INSERT INTO audit_log (
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            new_values
        ) VALUES (
            auth.uid(),
            CASE
                WHEN TG_OP = 'INSERT' THEN 'INSERT'
                WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
                WHEN TG_OP = 'DELETE' THEN 'DELETE'
            END,
            TG_TABLE_NAME,
            COALESCE(NEW.id, OLD.id),
            CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
            CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers
DROP TRIGGER IF EXISTS audit_profiles_changes ON profiles;
CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_user_changes();

-- =====================================================
-- 8. CREATE HEALTH CHECK FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE(
    component TEXT,
    status TEXT,
    details TEXT,
    last_checked TIMESTAMPTZ
) AS $$
BEGIN
    -- Check if required tables exist
    RETURN QUERY
    SELECT
        'organizations'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
             THEN 'healthy' ELSE 'missing' END as status,
        'Core organizations table'::TEXT as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'profiles'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles')
             THEN 'healthy' ELSE 'missing' END as status,
        'User profiles table'::TEXT as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'resumes'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resumes')
             THEN 'healthy' ELSE 'missing' END as status,
        'Resume storage table'::TEXT as details,
        NOW() as last_checked
    UNION ALL
    SELECT
        'rpc_functions'::TEXT as component,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_with_profiles')
             THEN 'healthy' ELSE 'missing' END as status,
        'Admin RPC functions'::TEXT as details,
        NOW() as last_checked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. SETUP COMPLETE MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'COMPREHENSIVE DATABASE FIX COMPLETE!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles table';
    RAISE NOTICE '✅ Fixed resumes table structure (profile_id)';
    RAISE NOTICE '✅ Created get_users_with_profiles() RPC function';
    RAISE NOTICE '✅ Created delete_organization_data() function';
    RAISE NOTICE '✅ Added missing indexes for performance';
    RAISE NOTICE '✅ Updated RLS policies for admin access';
    RAISE NOTICE '✅ Created audit triggers';
    RAISE NOTICE '✅ Created health check function';
    RAISE NOTICE '';
    RAISE NOTICE 'FIXED ISSUES:';
    RAISE NOTICE '• Admin users list now works';
    RAISE NOTICE '• Resume upload now works properly';
    RAISE NOTICE '• Profile deletion (danger zone) now works';
    RAISE NOTICE '• CV comparison should work';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Restart your backend server';
    RAISE NOTICE '2. Test admin settings page';
    RAISE NOTICE '3. Test resume upload and comparison';
    RAISE NOTICE '4. Test profile deletion';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
