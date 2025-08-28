-- Comprehensive fix for production deployment issues
-- Run this in Supabase SQL Editor to resolve all reported errors

-- 1. Fix admin users function permissions
DROP FUNCTION IF EXISTS get_users_with_profiles() CASCADE;

CREATE OR REPLACE FUNCTION get_users_with_profiles()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL
AS $$
    SELECT
        p.id,
        p.full_name,
        COALESCE(p.email, au.email) as email,
        p.organization_name,
        p.role,
        p.created_at
    FROM profiles p
    LEFT JOIN auth.users au ON p.id = au.id
    ORDER BY p.created_at DESC;
$$;

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_profiles() TO service_role;

-- 2. Create fallback function for when auth.users is not accessible
CREATE OR REPLACE FUNCTION get_profiles_only()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE SQL
AS $$
    SELECT
        id,
        full_name,
        email,
        organization_name,
        role,
        created_at
    FROM profiles
    ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_profiles_only() TO authenticated;
GRANT EXECUTE ON FUNCTION get_profiles_only() TO service_role;

-- 3. Ensure resumes table exists with proper structure
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
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

-- 4. Ensure cv_uploads storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv_uploads', 'cv_uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Set up proper storage policies
DROP POLICY IF EXISTS "Users can upload their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own CVs" ON storage.objects;

CREATE POLICY "Users can upload their own CVs" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own CVs" ON storage.objects
FOR SELECT USING (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own CVs" ON storage.objects
FOR DELETE USING (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Ensure proper RLS policies for resumes table
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON resumes;

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

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_uploaded_at ON resumes(uploaded_at DESC);

-- 8. Test all functions work
SELECT 'Testing get_users_with_profiles function:' as test;
SELECT COUNT(*) as user_count FROM get_users_with_profiles();

SELECT 'Testing get_profiles_only function:' as test;
SELECT COUNT(*) as profile_count FROM get_profiles_only();

-- 9. Verify table structures
SELECT 'Tables verified:' as status;
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'resumes', 'organizations')
ORDER BY table_name;

-- 10. Verify storage bucket
SELECT 'Storage bucket verified:' as status;
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets 
WHERE id = 'cv_uploads';

-- 11. Show function permissions
SELECT 
    'Function permissions:' as status,
    routine_name,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('get_users_with_profiles', 'get_profiles_only');
