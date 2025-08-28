-- =====================================================
-- ADD ORGANIZATION_ID COLUMN TO EXISTING PROFILES TABLE
-- =====================================================
-- This script adds the organization_id column to existing profiles tables
-- and populates it based on organization_name matches.
-- =====================================================

-- =====================================================
-- STEP 1: ADD ORGANIZATION_ID COLUMN
-- =====================================================

-- Add the organization_id column to profiles table if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 2: CREATE ORGANIZATIONS FROM EXISTING NAMES
-- =====================================================

-- Insert organizations based on unique organization_name values from profiles
INSERT INTO organizations (name, created_at, updated_at)
SELECT DISTINCT
    organization_name,
    NOW(),
    NOW()
FROM profiles
WHERE organization_name IS NOT NULL
AND organization_name != ''
AND organization_name NOT IN (
    SELECT name FROM organizations
)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 3: POPULATE ORGANIZATION_ID IN PROFILES
-- =====================================================

-- Update profiles to set organization_id based on organization_name match
UPDATE profiles
SET organization_id = organizations.id
FROM organizations
WHERE profiles.organization_name = organizations.name
AND profiles.organization_id IS NULL;

-- =====================================================
-- STEP 4: CREATE INDEX FOR PERFORMANCE
-- =====================================================

-- Add index for the new organization_id column
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);

-- =====================================================
-- STEP 5: VERIFY THE CHANGES
-- =====================================================

-- Check that the column was added successfully
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'organization_id'
AND table_schema = 'public';

-- Show organization relationships
SELECT
    p.id as profile_id,
    p.full_name,
    p.organization_name,
    o.name as organization_name,
    p.role
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
ORDER BY p.organization_name, p.role DESC;

-- =====================================================
-- STEP 6: SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Organization ID Column Added Successfully!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ organization_id column added to profiles table';
    RAISE NOTICE '✅ Organizations created from existing names';
    RAISE NOTICE '✅ Profile organization_id values populated';
    RAISE NOTICE '✅ Index created for performance';
    RAISE NOTICE '';
    RAISE NOTICE 'The database is now fully compliant!';
    RAISE NOTICE '=================================================';
END $$;
