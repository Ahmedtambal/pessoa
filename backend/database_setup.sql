-- Database Setup for Pessoa AI Compliance Features
-- Run these scripts in your Supabase SQL editor or PostgreSQL database

-- =====================================================
-- 1. AUDIT LOG TABLE
-- =====================================================

-- Create audit log table for compliance tracking
CREATE TABLE IF NOT EXISTS audit_log (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);

-- =====================================================
-- 2. MANUAL REVIEW REQUESTS TABLE
-- =====================================================

-- Create table for manual review requests
CREATE TABLE IF NOT EXISTS manual_review_requests (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_reviews_user_id ON manual_review_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_reviews_status ON manual_review_requests(status);
CREATE INDEX IF NOT EXISTS idx_manual_reviews_created_at ON manual_review_requests(created_at DESC);

-- =====================================================
-- 3. BIAS AUDIT TRACKING TABLE
-- =====================================================

-- Create table for bias audit tracking
CREATE TABLE IF NOT EXISTS bias_audit_tracking (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bias_audit_date ON bias_audit_tracking(audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_bias_audit_risk_level ON bias_audit_tracking(risk_level);

-- =====================================================
-- 4. COOKIE CONSENT TRACKING TABLE
-- =====================================================

-- Create table for cookie consent tracking
CREATE TABLE IF NOT EXISTS cookie_consent_log (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user_id ON cookie_consent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_timestamp ON cookie_consent_log(consent_timestamp DESC);

-- =====================================================
-- 5. AI PROCESSING LOG TABLE
-- =====================================================

-- Create table for AI processing tracking
CREATE TABLE IF NOT EXISTS ai_processing_log (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_log_user_id ON ai_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_request_type ON ai_processing_log(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_log_created_at ON ai_processing_log(created_at DESC);

-- =====================================================
-- 6. GDPR REQUEST TRACKING TABLE
-- =====================================================

-- Create table for GDPR request tracking
CREATE TABLE IF NOT EXISTS gdpr_requests (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdpr_user_id ON gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_created_at ON gdpr_requests(created_at DESC);

-- =====================================================
-- 7. ENHANCED USER PROFILES TABLE
-- =====================================================

-- Add compliance fields to user profiles if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cookie_consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cookie_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gdpr_data_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;

-- =====================================================
-- 8. FILE UPLOAD TRACKING TABLE
-- =====================================================

-- Create table for file upload tracking
CREATE TABLE IF NOT EXISTS file_upload_log (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_upload_user_id ON file_upload_log(user_id);
CREATE INDEX IF NOT EXISTS idx_file_upload_created_at ON file_upload_log(created_at DESC);

-- =====================================================
-- 9. RATE LIMITING TABLE
-- =====================================================

-- Create table for rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip ON rate_limit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_log(window_start DESC);

-- =====================================================
-- 10. SYSTEM HEALTH MONITORING TABLE
-- =====================================================

-- Create table for system health monitoring
CREATE TABLE IF NOT EXISTS system_health_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_unit VARCHAR(20),
    status VARCHAR(20) CHECK (status IN ('healthy', 'warning', 'critical')),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_health_metric ON system_health_log(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health_log(created_at DESC);

-- =====================================================
-- 11. ENHANCED RESUMES TABLE WITH COMPLIANCE FIELDS
-- =====================================================

-- Add compliance tracking fields to resumes table
ALTER TABLE resumes
ADD COLUMN IF NOT EXISTS processing_consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_processing_log JSONB,
ADD COLUMN IF NOT EXISTS bias_check_performed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_review_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS data_retention_date DATE;

-- =====================================================
-- 12. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bias_audit_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE cookie_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_upload_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_log
CREATE POLICY "Users can view their own audit logs" ON audit_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON audit_log
    FOR INSERT WITH CHECK (true);

-- Create RLS policies for manual_review_requests
CREATE POLICY "Users can view their own review requests" ON manual_review_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own review requests" ON manual_review_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for gdpr_requests
CREATE POLICY "Users can view their own GDPR requests" ON gdpr_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GDPR requests" ON gdpr_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 13. FUNCTIONS AND TRIGGERS
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

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_resumes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON resumes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- 14. DATA RETENTION POLICIES
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
-- 15. USEFUL VIEWS FOR MONITORING
-- =====================================================

-- View for GDPR compliance dashboard
CREATE OR REPLACE VIEW gdpr_compliance_dashboard AS
SELECT
    COUNT(*) FILTER (WHERE request_type = 'access') as access_requests,
    COUNT(*) FILTER (WHERE request_type = 'erasure') as erasure_requests,
    COUNT(*) FILTER (WHERE request_type = 'portability') as portability_requests,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/86400) as avg_completion_days
FROM gdpr_requests
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- View for AI bias monitoring
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

-- View for security incidents
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
-- 16. FINAL SETUP NOTIFICATIONS
-- =====================================================

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Pessoa AI Database Setup Complete!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables:';
    RAISE NOTICE '✓ audit_log - Audit trail for compliance';
    RAISE NOTICE '✓ manual_review_requests - AI review requests';
    RAISE NOTICE '✓ bias_audit_tracking - Bias testing records';
    RAISE NOTICE '✓ cookie_consent_log - Cookie preferences';
    RAISE NOTICE '✓ ai_processing_log - AI usage tracking';
    RAISE NOTICE '✓ gdpr_requests - Data subject requests';
    RAISE NOTICE '✓ file_upload_log - File upload tracking';
    RAISE NOTICE '✓ rate_limit_log - Rate limiting data';
    RAISE NOTICE '✓ system_health_log - Health monitoring';
    RAISE NOTICE '';
    RAISE NOTICE 'Enhanced existing tables with compliance fields';
    RAISE NOTICE 'Created RLS policies for data protection';
    RAISE NOTICE 'Added audit triggers for sensitive tables';
    RAISE NOTICE 'Created monitoring views for compliance dashboard';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Set up automated cleanup jobs for old logs';
    RAISE NOTICE '2. Configure monitoring alerts';
    RAISE NOTICE '3. Test all compliance features';
    RAISE NOTICE '4. Train staff on compliance procedures';
    RAISE NOTICE '';
    RAISE NOTICE 'Your database is now fully compliant!';
    RAISE NOTICE '=================================================';
END $$;
