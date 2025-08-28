-- =====================================================
-- PESSOA AI DATABASE RESET & COMPLIANCE SETUP
-- =====================================================
-- ⚠️  WARNING: THIS SCRIPT WILL DELETE ALL EXISTING DATA
-- =====================================================
-- Run this script to completely reset your database with
-- full UK GDPR compliance features and proper structure.
--
-- BEFORE RUNNING:
-- 1. Backup any important data
-- 2. Ensure you understand this will delete everything
-- 3. Test on a development environment first
--
-- AFTER RUNNING:
-- 1. Run the database_setup.sql script to create compliance tables
-- 2. Update your application environment variables
-- 3. Test all compliance features
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING TABLES AND DATA
-- =====================================================

-- Drop all existing tables in reverse dependency order
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS manual_review_requests CASCADE;
DROP TABLE IF EXISTS bias_audit_tracking CASCADE;
DROP TABLE IF EXISTS cookie_consent_log CASCADE;
DROP TABLE IF EXISTS ai_processing_log CASCADE;
DROP TABLE IF EXISTS gdpr_requests CASCADE;
DROP TABLE IF EXISTS file_upload_log CASCADE;
DROP TABLE IF EXISTS rate_limit_log CASCADE;
DROP TABLE IF EXISTS system_health_log CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop any other tables that might exist
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('schema_migrations', 'pg_stat_statements')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || table_name || ' CASCADE';
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: CLEAN UP FUNCTIONS AND TRIGGERS
-- =====================================================

-- Drop any existing functions
DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;
DROP FUNCTION IF EXISTS log_profile_access() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_audit_logs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_ai_logs() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_logs() CASCADE;

-- =====================================================
-- STEP 3: RECREATE COMPLIANT DATABASE STRUCTURE
-- =====================================================

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create profiles table with compliance fields
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    organization_name VARCHAR(255),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'MEMBER')) DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Compliance fields
    marketing_consent BOOLEAN DEFAULT false,
    analytics_consent BOOLEAN DEFAULT false,
    cookie_consent_given BOOLEAN DEFAULT false,
    cookie_consent_date TIMESTAMPTZ,
    gdpr_data_processing BOOLEAN DEFAULT false,
    last_login_ip INET,
    login_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT false,
    account_locked_until TIMESTAMPTZ
);

-- Create resumes table with compliance fields
CREATE TABLE resumes (
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
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Compliance fields
    processing_consent_given BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    ai_processing_log JSONB,
    bias_check_performed BOOLEAN DEFAULT false,
    manual_review_requested BOOLEAN DEFAULT false,
    compliance_flags JSONB DEFAULT '{}',
    data_retention_date DATE
);

-- =====================================================
-- STEP 4: CREATE COMPLIANCE TABLES
-- =====================================================

-- Audit log table for compliance tracking
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual review requests table
CREATE TABLE manual_review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_id UUID,
    request_reason VARCHAR(100) NOT NULL CHECK (request_reason IN (
        'disagree-with-analysis',
        'missing-information',
        'bias-concern',
        'accuracy-concern',
        'other'
    )),
    request_details TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in-review',
        'completed',
        'rejected'
    )),
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    review_notes TEXT,
    review_outcome VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Bias audit tracking table
CREATE TABLE bias_audit_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    audit_type VARCHAR(50) NOT NULL CHECK (audit_type IN (
        'quarterly',
        'monthly',
        'ad-hoc',
        'incident-response'
    )),
    model_version VARCHAR(50),
    dataset_size INTEGER,
    bias_metrics JSONB,
    risk_level VARCHAR(20) CHECK (risk_level IN (
        'critical',
        'moderate',
        'minor',
        'acceptable'
    )),
    recommendations TEXT,
    auditor_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cookie consent log table
CREATE TABLE cookie_consent_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    consent_given BOOLEAN NOT NULL,
    necessary_cookies BOOLEAN NOT NULL DEFAULT true,
    analytics_cookies BOOLEAN NOT NULL DEFAULT false,
    marketing_cookies BOOLEAN NOT NULL DEFAULT false,
    functional_cookies BOOLEAN NOT NULL DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    consent_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- AI processing log table
CREATE TABLE ai_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'cv_analysis',
        'jd_generation',
        'cv_comparison'
    )),
    input_tokens INTEGER,
    output_tokens INTEGER,
    processing_time_ms INTEGER,
    model_used VARCHAR(100),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    cache_hit BOOLEAN DEFAULT false,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GDPR requests table
CREATE TABLE gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'access',
        'rectification',
        'erasure',
        'portability',
        'restriction',
        'objection',
        'withdraw-consent'
    )),
    request_details TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in-progress',
        'completed',
        'rejected'
    )),
    completion_notes TEXT,
    requested_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- File upload log table
CREATE TABLE file_upload_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    storage_path VARCHAR(500),
    upload_success BOOLEAN NOT NULL,
    processing_success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limit log table
CREATE TABLE rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health log table
CREATE TABLE system_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20),
    status VARCHAR(20) CHECK (status IN ('healthy', 'warning', 'critical')),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles table indexes
CREATE INDEX idx_profiles_organization_name ON profiles(organization_name);
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_created_at ON profiles(created_at DESC);

-- Resumes table indexes
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_profile_id ON resumes(profile_id);
CREATE INDEX idx_resumes_uploaded_at ON resumes(uploaded_at DESC);
CREATE INDEX idx_resumes_file_name ON resumes(file_name);

-- Audit log indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);

-- Manual review indexes
CREATE INDEX idx_manual_reviews_user_id ON manual_review_requests(user_id);
CREATE INDEX idx_manual_reviews_status ON manual_review_requests(status);
CREATE INDEX idx_manual_reviews_created_at ON manual_review_requests(created_at DESC);

-- Bias audit indexes
CREATE INDEX idx_bias_audit_date ON bias_audit_tracking(audit_date DESC);
CREATE INDEX idx_bias_audit_risk_level ON bias_audit_tracking(risk_level);

-- Cookie consent indexes
CREATE INDEX idx_cookie_consent_user_id ON cookie_consent_log(user_id);
CREATE INDEX idx_cookie_consent_timestamp ON cookie_consent_log(consent_timestamp DESC);

-- AI processing indexes
CREATE INDEX idx_ai_log_user_id ON ai_processing_log(user_id);
CREATE INDEX idx_ai_log_request_type ON ai_processing_log(request_type);
CREATE INDEX idx_ai_log_created_at ON ai_processing_log(created_at DESC);

-- GDPR requests indexes
CREATE INDEX idx_gdpr_user_id ON gdpr_requests(user_id);
CREATE INDEX idx_gdpr_status ON gdpr_requests(status);
CREATE INDEX idx_gdpr_created_at ON gdpr_requests(created_at DESC);

-- File upload indexes
CREATE INDEX idx_file_upload_user_id ON file_upload_log(user_id);
CREATE INDEX idx_file_upload_created_at ON file_upload_log(created_at DESC);

-- Rate limit indexes
CREATE INDEX idx_rate_limit_ip ON rate_limit_log(ip_address);
CREATE INDEX idx_rate_limit_window ON rate_limit_log(window_start DESC);

-- System health indexes
CREATE INDEX idx_system_health_metric ON system_health_log(metric_name);
CREATE INDEX idx_system_health_created_at ON system_health_log(created_at DESC);

-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bias_audit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_upload_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: CREATE RLS POLICIES
-- =====================================================

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

-- Audit log policies
CREATE POLICY "Users can view their own audit logs"
ON audit_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON audit_log FOR INSERT
WITH CHECK (true);

-- Manual review policies
CREATE POLICY "Users can view their own review requests"
ON manual_review_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own review requests"
ON manual_review_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- GDPR request policies
CREATE POLICY "Users can view their own GDPR requests"
ON gdpr_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GDPR requests"
ON gdpr_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- STEP 8: CREATE COMPLIANCE FUNCTIONS
-- =====================================================

-- Function to automatically create audit log entries
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_row JSONB;
    new_row JSONB;
    action_type VARCHAR(10);
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        action_type := 'INSERT';
        old_row := NULL;
        new_row := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'UPDATE';
        old_row := row_to_json(OLD)::JSONB;
        new_row := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'DELETE';
        old_row := row_to_json(OLD)::JSONB;
        new_row := NULL;
    END IF;

    -- Insert audit log entry
    INSERT INTO audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        auth.uid(),
        action_type,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        old_row,
        new_row,
        inet_client_addr()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 9: CREATE AUDIT TRIGGERS
-- =====================================================

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_resumes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON resumes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- STEP 10: CREATE DATA RETENTION FUNCTIONS
-- =====================================================

-- Function to clean up old audit logs (keep last 2 years)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM audit_log
    WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old AI processing logs (keep last 6 months)
CREATE OR REPLACE FUNCTION cleanup_old_ai_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM ai_processing_log
    WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old rate limit logs (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_logs()
RETURNS VOID AS $$
BEGIN
    DELETE FROM rate_limit_log
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 11: CREATE MONITORING VIEWS
-- =====================================================

-- GDPR compliance dashboard view
CREATE OR REPLACE VIEW gdpr_compliance_dashboard AS
SELECT
    COUNT(*) FILTER (WHERE request_type = 'access') as access_requests,
    COUNT(*) FILTER (WHERE request_type = 'erasure') as erasure_requests,
    COUNT(*) FILTER (WHERE request_type = 'portability') as portability_requests,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400) as avg_completion_days
FROM gdpr_requests
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- AI bias monitoring view
CREATE OR REPLACE VIEW ai_bias_monitoring AS
SELECT
    DATE_TRUNC('week', created_at) as week,
    request_type,
    COUNT(*) as total_requests,
    AVG(processing_time_ms) as avg_processing_time,
    COUNT(*) FILTER (WHERE success = false) as failed_requests
FROM ai_processing_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', created_at), request_type
ORDER BY week DESC, request_type;

-- Security incidents view
CREATE OR REPLACE VIEW security_incidents AS
SELECT
    DATE_TRUNC('day', created_at) as incident_date,
    COUNT(*) FILTER (WHERE action = 'RATE_LIMIT_EXCEEDED') as rate_limit_hits,
    COUNT(*) FILTER (WHERE action = 'FAILED_LOGIN') as failed_logins,
    COUNT(*) FILTER (WHERE action = 'SUSPICIOUS_ACTIVITY') as suspicious_activities
FROM audit_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND action IN ('RATE_LIMIT_EXCEEDED', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY')
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY incident_date DESC;

-- =====================================================
-- STEP 12: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON resumes TO authenticated;
GRANT SELECT ON organizations TO authenticated;
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT, INSERT ON manual_review_requests TO authenticated;
GRANT SELECT, INSERT ON gdpr_requests TO authenticated;
GRANT SELECT, INSERT ON cookie_consent_log TO authenticated;

-- =====================================================
-- STEP 13: CREATE DEFAULT ORGANIZATION (OPTIONAL)
-- =====================================================

-- Insert a default organization (uncomment if needed)
-- INSERT INTO organizations (name) VALUES ('Default Organization')
-- ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- STEP 14: FINAL SETUP VERIFICATION
-- =====================================================

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Pessoa AI Database Reset Complete!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ All old data has been deleted';
    RAISE NOTICE '✅ New compliant database structure created';
    RAISE NOTICE '✅ All compliance tables are ready';
    RAISE NOTICE '✅ Row Level Security enabled';
    RAISE NOTICE '✅ Audit triggers created';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '✅ Monitoring views created';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create your admin profile manually if needed';
    RAISE NOTICE '2. Update application environment variables';
    RAISE NOTICE '3. Test all compliance features';
    RAISE NOTICE '4. Set up automated cleanup jobs';
    RAISE NOTICE '';
    RAISE NOTICE 'Your database is now fully compliant!';
    RAISE NOTICE '=================================================';
END $$;
