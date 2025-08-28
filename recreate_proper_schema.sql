-- RECREATE PROPER DATABASE SCHEMA
-- Organization -> Profile -> Other Data (Resumes) structure

-- First clean up any existing tables (safe approach)
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS TABLE (Top level)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES TABLE (Links to organizations)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RESUMES TABLE (Links to profiles)
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Legacy support
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Preferred
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    name TEXT,
    job_title TEXT,
    email TEXT,
    phone_number TEXT,
    location TEXT,
    work_experience_summary TEXT,
    skills_summary TEXT,
    education_summary TEXT,
    full_extracted_text TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_organization_name ON profiles(organization_name);
CREATE INDEX idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_organizations_name ON organizations(name);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to automatically update updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create helper functions that the application expects
CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT
)
LANGUAGE SQL
AS $$
    SELECT
        p.id,
        p.full_name,
        p.email,
        p.organization_name,
        p.role
    FROM profiles p
    JOIN auth.users u ON p.id = u.id
    ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION delete_organization_data(org_name TEXT)
RETURNS VOID
LANGUAGE PLPGSQL
AS $$
BEGIN
    -- Delete all resumes from profiles in this organization
    DELETE FROM resumes
    WHERE profile_id IN (
        SELECT id FROM profiles
        WHERE organization_name = org_name
    );

    -- Delete all profiles in this organization
    DELETE FROM profiles WHERE organization_name = org_name;

    -- Delete the organization itself
    DELETE FROM organizations WHERE name = org_name;
END;
$$;

-- Row Level Security (RLS) policies (optional but recommended for Supabase)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (you may want to customize these)
CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (
        name IN (
            SELECT organization_name FROM profiles
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view their own resumes" ON resumes
    FOR SELECT USING (
        profile_id = auth.uid() OR user_id = auth.uid()
    );

CREATE POLICY "Users can insert their own resumes" ON resumes
    FOR INSERT WITH CHECK (
        profile_id = auth.uid() OR user_id = auth.uid()
    );

CREATE POLICY "Users can delete their own resumes" ON resumes
    FOR DELETE USING (
        profile_id = auth.uid() OR user_id = auth.uid()
    );

-- Verify the schema creation
SELECT 'Schema recreation completed successfully!' as status;

SELECT
    'Tables created:' as info,
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('organizations', 'profiles', 'resumes')
ORDER BY tablename;

SELECT
    'Functions created:' as info,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('get_users_with_profiles', 'delete_organization_data')
ORDER BY routine_name;
