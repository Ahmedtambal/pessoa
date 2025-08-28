-- =====================================================
-- MINIMAL DATABASE SETUP FOR PESSOA AI
-- =====================================================
-- This creates only the essential tables needed for
-- basic registration and file upload functionality.
-- For full compliance features, use database_reset_compliance.sql
-- =====================================================

-- =====================================================
-- 1. CREATE ORGANIZATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    organization_name VARCHAR(255),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'MEMBER')) DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. CREATE RESUMES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(500),
    storage_path VARCHAR(500),
    name VARCHAR(255),
    job_title VARCHAR(255),
    email VARCHAR(255),
    phone_number VARCHAR(255),
    location VARCHAR(255),
    work_experience_summary TEXT,
    skills_summary TEXT,
    education_summary TEXT,
    full_extracted_text TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_organization_name ON profiles(organization_name);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_uploaded_at ON resumes(uploaded_at DESC);

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. CREATE BASIC RLS POLICIES
-- =====================================================

-- Organizations policies
CREATE POLICY "Organization members can view their organization"
ON organizations FOR SELECT
USING (
    id IN (
        SELECT organization_id
        FROM profiles
        WHERE id = auth.uid()
    )
);

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users only"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Resumes policies
CREATE POLICY "Users can view own resumes"
ON resumes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes"
ON resumes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes"
ON resumes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes"
ON resumes FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON organizations TO service_role;
GRANT ALL ON profiles TO service_role;
GRANT ALL ON resumes TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =====================================================
-- 8. CREATE A DEFAULT ADMIN USER
-- =====================================================

-- Note: Replace these values with your actual user ID and details
-- You can find your user ID in Supabase Auth -> Users

DO $$
DECLARE
    admin_user_id UUID := 'your-user-id-here'; -- Replace with your user ID
    admin_email TEXT := 'your-email@example.com'; -- Replace with your email
    admin_name TEXT := 'Admin User'; -- Replace with your name
    admin_org TEXT := 'Your Organization'; -- Replace with your organization
BEGIN
    -- Create organization if it doesn't exist
    INSERT INTO organizations (name) VALUES (admin_org)
    ON CONFLICT (name) DO NOTHING;

    -- Create admin profile
    INSERT INTO profiles (id, full_name, organization_name, organization_id, role)
    SELECT
        admin_user_id,
        admin_name,
        admin_org,
        o.id,
        'ADMIN'
    FROM organizations o
    WHERE o.name = admin_org
    ON CONFLICT (id) DO UPDATE SET
        role = 'ADMIN',
        full_name = EXCLUDED.full_name,
        organization_name = EXCLUDED.organization_name,
        organization_id = EXCLUDED.organization_id;

    RAISE NOTICE 'Admin user setup complete!';
    RAISE NOTICE 'User ID: %', admin_user_id;
    RAISE NOTICE 'Email: %', admin_email;
    RAISE NOTICE 'Role: ADMIN';
END $$;

-- =====================================================
-- SETUP COMPLETE MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Minimal Database Setup Complete!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ organizations table created';
    RAISE NOTICE '✅ profiles table created';
    RAISE NOTICE '✅ resumes table created';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '✅ Row Level Security enabled';
    RAISE NOTICE '✅ Basic RLS policies created';
    RAISE NOTICE '✅ Permissions granted';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update the admin user details in the script above';
    RAISE NOTICE '2. Re-run the script with your actual details';
    RAISE NOTICE '3. Test registration and file upload';
    RAISE NOTICE '';
    RAISE NOTICE 'For full compliance features, run:';
    RAISE NOTICE 'database_reset_compliance.sql';
    RAISE NOTICE '=================================================';
END $$;
