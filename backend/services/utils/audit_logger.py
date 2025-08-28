from typing import Any, Dict, Optional
from fastapi import Request
from supabase import Client
import datetime

def _safe_get_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    try:
        xff = request.headers.get('x-forwarded-for')
        if xff:
            return xff.split(',')[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None

def _safe_get_ua(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    try:
        return request.headers.get('user-agent')
    except Exception:
        return None

def log_event(
    supabase: Client,
    *,
    event_type: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    organization_name: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    payload: Dict[str, Any] = {
        'event_type': event_type,
        'user_id': user_id,
        'email': email,
        'organization_name': organization_name,
        'ip_address': _safe_get_ip(request),
        'user_agent': _safe_get_ua(request),
        'details': details or {},
        'created_at': datetime.datetime.utcnow().isoformat() + 'Z',
    }
    try:
        supabase.table('audit_log').insert(payload).execute()
    except Exception as e:
        # Do not raise; audits must not break primary flows
        try:
            print('[audit_logger] failed to write audit log:', e)
        except Exception:
            pass


