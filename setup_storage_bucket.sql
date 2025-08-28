-- Setup storage bucket for CV uploads
-- Run this if you're getting storage-related errors

-- Create the cv_uploads bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv_uploads', 'cv_uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the cv_uploads bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own CVs" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own uploaded files
CREATE POLICY "Users can view their own CVs" ON storage.objects
FOR SELECT USING (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own CVs" ON storage.objects
FOR DELETE USING (
    bucket_id = 'cv_uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verify bucket creation
SELECT
    'Storage bucket setup:' as status,
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE id = 'cv_uploads';

-- Check existing policies
SELECT
    'Storage policies:' as status,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'objects'
    AND schemaname = 'storage';
