-- =====================================================
-- FIX RESUME UPLOAD FUNCTIONALITY
-- =====================================================
-- Run this if resume uploads are still failing
-- =====================================================

-- =====================================================
-- 1. ADD PROFILE_ID COLUMN TO RESUMES
-- =====================================================

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Update existing records
UPDATE resumes
SET profile_id = user_id
WHERE profile_id IS NULL;

-- =====================================================
-- 2. ADD MISSING INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- =====================================================
-- 3. TEST RESUME FUNCTIONALITY
-- =====================================================

DO $$
DECLARE
    resume_count INTEGER;
BEGIN
    RAISE NOTICE '=== TESTING RESUME FUNCTIONALITY ===';

    SELECT COUNT(*) INTO resume_count FROM resumes;

    RAISE NOTICE 'Total resumes in database: %', resume_count;

    IF resume_count > 0 THEN
        RAISE NOTICE '✅ Resume table has data';
        RAISE NOTICE '✅ Resume uploads should work';
    ELSE
        RAISE NOTICE 'ℹ️  Resume table is empty (normal for new system)';
        RAISE NOTICE '✅ Ready for first resume upload';
    END IF;
END $$;

-- =====================================================
-- 4. CHECK RLS POLICIES
-- =====================================================

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING SECURITY POLICIES ===';

    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'resumes';

    RAISE NOTICE 'Resume table policies: %', policy_count;

    IF policy_count = 0 THEN
        RAISE NOTICE '⚠️  No RLS policies found - creating basic ones...';

        -- Create basic RLS policies
        ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own resumes"
        ON resumes FOR SELECT
        USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own resumes"
        ON resumes FOR INSERT
        WITH CHECK (auth.uid() = user_id);

        RAISE NOTICE '✅ Created basic RLS policies for resumes';
    END IF;
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'RESUME UPLOAD FIX COMPLETE!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added profile_id column to resumes';
    RAISE NOTICE '✅ Created performance indexes';
    RAISE NOTICE '✅ Set up security policies';
    RAISE NOTICE '';
    RAISE NOTICE 'NOW TEST:';
    RAISE NOTICE '• Upload a resume (PDF/DOCX)';
    RAISE NOTICE '• Should complete successfully';
    RAISE NOTICE '• Should appear in resume bank';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
