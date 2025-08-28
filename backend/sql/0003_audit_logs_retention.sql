-- Add retention column to audit_logs and create a purge function

ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz NULL;

-- Convenience function to mark retention for an existing row
CREATE OR REPLACE FUNCTION public.set_audit_retention(p_id uuid, p_ttl_interval interval)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.audit_logs
  SET retention_expires_at = now() + p_ttl_interval
  WHERE id = p_id;
$$;

-- Purge function to delete expired audit logs. Use with a scheduled job (e.g., Supabase scheduled functions)
CREATE OR REPLACE FUNCTION public.purge_expired_audit_logs()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  deleted_count int := 0;
BEGIN
  DELETE FROM public.audit_logs
  WHERE retention_expires_at IS NOT NULL AND retention_expires_at < now()
  RETURNING 1 INTO deleted_count;

  -- Return number of rows removed (approximate)
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Example: schedule this purge using Supabase scheduled functions or an external cron to call:
-- SELECT public.purge_expired_audit_logs();
