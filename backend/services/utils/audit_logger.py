from typing import Any, Dict, Optional
from fastapi import Request
from supabase import Client
from typing import Tuple
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

def _snapshot_actor(supabase: Client, user_id: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not user_id:
        return None, None, None
    try:
        resp = supabase.table('profiles').select('email, organization_id, organization_name').eq('id', user_id).single().execute()
        if resp and getattr(resp, 'data', None):
            data = resp.data
            return data.get('email'), data.get('organization_id'), data.get('organization_name')
    except Exception:
        pass
    return None, None, None

def log_event(
    supabase: Client,
    *,
    action_type: str,
    status: str = 'SUCCESS',
    user_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    actor_email, actor_org_id, actor_org_name = _snapshot_actor(supabase, user_id)
    payload: Dict[str, Any] = {
        'action_type': action_type,
        'status': status,
        'actor_user_id': user_id,
        'actor_email_snapshot': actor_email,
        'actor_org_id_snapshot': actor_org_id,
        'actor_org_name_snapshot': actor_org_name,
        'target_type': target_type,
        'target_id': target_id,
        'ip_address': _safe_get_ip(request),
        'user_agent': _safe_get_ua(request),
        'metadata': metadata or {},
    }
    try:
        supabase.table('audit_events').insert(payload).execute()
    except Exception as e:
        try:
            print('[audit_logger] failed to write audit event:', e)
        except Exception:
            pass


