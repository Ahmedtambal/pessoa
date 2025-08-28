from supabase import create_client
from config.settings import settings
import json

def get_admin_client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def log_audit(user_id: str | None, action: str, model: str | None = None, prompt: str | None = None, output: str | None = None, details: dict | None = None):
    """Insert an audit log row into the audit_logs table.

    user_id can be None for system actions.
    """
    supabase = get_admin_client()
    payload = {
        'user_id': user_id,
        'action': action,
        'model': model,
        'prompt': prompt,
        'output': output,
        'details': details or {}
    }
    try:
        supabase.table('audit_logs').insert(payload).execute()
    except Exception as e:
        # Do not raise on audit failure; just print for debugging
        print(f"[audit_service] failed to write audit log: {e}")
