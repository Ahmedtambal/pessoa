-- =====================================================
-- SIMPLE EMAIL COLUMN FIX
-- =====================================================
-- Run this if you get: "column p.email does not exist"
-- =====================================================

-- Add email column to profiles table if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Populate email data from auth.users for existing profiles
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id
  AND (profiles.email IS NULL OR profiles.email = '');

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Verify the fix
SELECT
    COUNT(*) as total_profiles,
    COUNT(email) as profiles_with_email,
    COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as non_empty_emails
FROM profiles;

-- Show sample data
SELECT id, full_name, email, role
FROM profiles
WHERE email IS NOT NULL AND email != ''
LIMIT 5;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
    total_count INTEGER;
    email_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM profiles;
    SELECT COUNT(*) INTO email_count FROM profiles WHERE email IS NOT NULL AND email != '';

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'EMAIL COLUMN ADDED SUCCESSFULLY!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Added email column to profiles table';
    RAISE NOTICE '✅ Populated % out of % profiles with email data', email_count, total_count;
    RAISE NOTICE '✅ Created performance index';
    RAISE NOTICE '';
    RAISE NOTICE 'Now your admin users list should work!';
    RAISE NOTICE 'Test it in Settings → Users';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
