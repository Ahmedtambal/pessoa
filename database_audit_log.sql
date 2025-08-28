-- Create audit_log table for org/user-scoped event tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    user_id UUID,
    email TEXT,
    organization_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_time ON audit_log(organization_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_time ON audit_log(event_type, created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org audit logs" ON audit_log;
CREATE POLICY "Users can view org audit logs" ON audit_log
    FOR SELECT USING (
        organization_name IS NULL OR organization_name IN (
            SELECT organization_name FROM profiles WHERE id = auth.uid()
        )
    );


