from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
import requests
from supabase import create_client, Client
from typing import Optional
from config.settings import settings
from services.utils.audit_logger import log_event
from fastapi import Depends
from supabase import Client, create_client
from .resume_analyzer import get_current_user
class CookieConsentRequest(BaseModel):
    necessary: bool = True
    analytics: bool = False
    marketing: bool = False
    functional: bool = False


router = APIRouter(prefix="", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    organization_name: Optional[str] = None
class RedeemInviteRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    code: str

    organization_name: Optional[str] = None


@router.post('/register')
def register_user(req: RegisterRequest, request: Request):
    """Create a new Supabase auth user using the service role key, upsert profile and organization.

    Security: This endpoint uses the service role key to create a user. It must not return any secrets.
    The endpoint will NOT sign the user in; client must sign in after email confirmation.
    """
    # Enhanced password validation for security
    if len(req.password) < 12:
        raise HTTPException(status_code=400, detail='Password must be at least 12 characters long')
    if not any(char.isupper() for char in req.password):
        raise HTTPException(status_code=400, detail='Password must contain at least one uppercase letter')
    if not any(char.islower() for char in req.password):
        raise HTTPException(status_code=400, detail='Password must contain at least one lowercase letter')
    if not any(char.isdigit() for char in req.password):
        raise HTTPException(status_code=400, detail='Password must contain at least one number')

    # 1) Create auth user via Supabase Admin REST API
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        'apikey': settings.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json'
    }
    payload = {
        'email': req.email,
        'password': req.password,
        # do not auto-confirm; email confirmation should be done by user
        'user_metadata': {}
    }
    if req.full_name:
        payload['user_metadata']['full_name'] = req.full_name
    if req.organization_name:
        payload['user_metadata']['organization_name'] = req.organization_name

    resp = requests.post(url, json=payload, headers=headers)
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail='Unexpected response from auth provider')

    # Log only non-sensitive information for security
    try:
        print(f'[register_user] supabase admin response status: {resp.status_code}')
        # Only log success/failure, not sensitive data
        if resp.ok:
            print('[register_user] User created successfully')
        else:
            print('[register_user] User creation failed - check error details')
    except Exception:
        pass

    if not resp.ok:
        # Supabase returns useful error messages in JSON
        raise HTTPException(status_code=400, detail=data)

    user = data.get('user') or data
    user_id = user.get('id')

    # 2) Upsert profile and organization using service-role client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    profile_payload = { 'id': user_id }
    if req.full_name:
        profile_payload['full_name'] = req.full_name

    # Default role: self-signups (no organization provided) should be ADMIN per requested semantics.
    # If an organization is provided, existing logic below will determine ADMIN vs MEMBER.
    role = 'ADMIN'
    if req.organization_name:
        org_name = req.organization_name.strip()
        # Always assign ADMIN when a user provides organization_name during signup
        profile_payload['organization_name'] = org_name

        # Try to handle organization relationship, but don't fail if table doesn't exist
        try:
            # Check if organizations table exists first
            supabase.table('organizations').select('id').limit(1).execute()

            # If we get here, the table exists, so proceed with organization logic
            org_check = supabase.table('organizations').select('id').eq('name', org_name).execute()
            if not org_check.data or len(org_check.data) == 0:
                # Organization doesn't exist, create it
                insert_resp = supabase.table('organizations').insert({'name': org_name}).execute()
                if getattr(insert_resp, 'data', None) and len(insert_resp.data) > 0:
                    org_id = insert_resp.data[0].get('id')
                    profile_payload['organization_id'] = org_id
            else:
                # Organization exists, get its ID
                org_id = org_check.data[0].get('id')
                profile_payload['organization_id'] = org_id
        except Exception as e:
            # If organizations table doesn't exist or any other error, just log and continue
            # The user can still register and we'll set up organizations later
            print('[register_user] Organization handling skipped (table may not exist):', str(e))

    profile_payload['role'] = role

    try:
        supabase.table('profiles').upsert(profile_payload).execute()
    except Exception as e:
        print('[register_user] profile upsert error:', e)
        # Attempt to clean up the created auth user to avoid orphaned users
        try:
            cleanup_url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
            requests.delete(cleanup_url, headers=headers)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail='Failed to create profile')

    # Return helpful debug info to the client (do not include secrets)
    user_info = {
        'id': user_id,
        'email': user.get('email'),
        'confirmed_at': user.get('confirmed_at') or user.get('email_confirmed_at') or None,
    }

    try:
        log_event(supabase, action_type='user_register', user_id=user_id, metadata={'email': user.get('email'), 'org': profile_payload.get('organization_name'), 'role': role}, request=request)
    except Exception:
        pass

    try:
        from services.utils.audit_logger import log_event
        from supabase import create_client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        log_event(supabase, action_type='register', user_id=user_id, metadata={'email': req.email, 'org': profile_payload.get('organization_name')}, request=request)
    except Exception:
        pass
    return {'message': 'User created. Please check your email to confirm and then sign in.', 'user': user_info}


@router.post('/redeem-invite')
def redeem_invite(req: RedeemInviteRequest, request: Request):
    """Create an auth user and profile using an approved invite code.

    Flow:
    - Validate invite exists, matches email, not expired/redeemed/revoked
    - Create user via admin API (service role)
    - Upsert profile with MEMBER role and inviter org
    - Mark invite as redeemed
    """
    # 1) Validate invite
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    inv = supabase.table('invites').select('*').eq('code', req.code).eq('email', req.email).eq('status', 'PENDING').single().execute()
    if getattr(inv, 'error', None) or not inv.data:
        raise HTTPException(status_code=400, detail='Invalid invite code or email')
    invite = inv.data
    from datetime import datetime, timezone
    if invite.get('expires_at'):
        try:
            expires = datetime.fromisoformat(str(invite['expires_at']).replace('Z','+00:00'))
            if expires < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail='Invite expired')
        except Exception:
            pass

    # 2) Create auth user via Admin API
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        'apikey': settings.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json'
    }
    payload = {
        'email': req.email,
        'password': req.password,
        'user_metadata': { 'full_name': req.full_name or '' }
    }
    resp = requests.post(url, json=payload, headers=headers)
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=500, detail='Unexpected response from auth provider')
    if not resp.ok:
        raise HTTPException(status_code=400, detail=data)

    user = data.get('user') or data
    user_id = user.get('id')

    # 3) Upsert profile with organization from invite
    profile_payload = { 'id': user_id, 'email': req.email, 'role': invite.get('role') or 'MEMBER' }
    if req.full_name:
        profile_payload['full_name'] = req.full_name
    if invite.get('organization_name'):
        profile_payload['organization_name'] = invite['organization_name']
    if invite.get('organization_id'):
        profile_payload['organization_id'] = invite['organization_id']

    try:
        supabase.table('profiles').upsert(profile_payload).execute()
    except Exception as e:
        # Cleanup auth user on failure
        try:
            cleanup_url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
            requests.delete(cleanup_url, headers=headers)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail='Failed to create profile')

    # 4) Mark invite as redeemed
    supabase.table('invites').update({ 'status': 'REDEEMED', 'used_by': user_id, 'used_at': 'now()' }).eq('id', invite['id']).execute()

    try:
        log_event(supabase, action_type='invite_redeem', user_id=user_id, metadata={'email': req.email, 'code': req.code, 'org': invite.get('organization_name')}, request=request)
    except Exception:
        pass

    try:
        log_event(supabase, action_type='redeem_invite', user_id=user_id, metadata={'email': req.email, 'code': req.code, 'org': invite.get('organization_name')}, request=request)
    except Exception:
        pass
    return {'message': 'Account created from invite. Please sign in.', 'user': { 'id': user_id, 'email': req.email }}


@router.post('/cookie-consent')
def save_cookie_consent(req: CookieConsentRequest, request: Request, current_user: dict | None = Depends(lambda: None)):
    """Persist cookie consent and audit the decision.

    Works with or without an authenticated user (stores IP/UA and a null user).
    """
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    try:
        payload = {
            'user_id': (current_user or {}).get('id') if isinstance(current_user, dict) else None,
            'consent_given': True,
            'necessary_cookies': bool(req.necessary),
            'analytics_cookies': bool(req.analytics),
            'marketing_cookies': bool(req.marketing),
            'functional_cookies': bool(req.functional),
            'ip_address': request.client.host if request.client else None,
            'user_agent': request.headers.get('user-agent'),
        }
        supabase.table('cookie_consent_log').insert(payload).execute()
        try:
            log_event(supabase, action_type='cookie_consent', user_id=payload['user_id'], metadata={
                'necessary': payload['necessary_cookies'],
                'analytics': payload['analytics_cookies'],
                'marketing': payload['marketing_cookies'],
                'functional': payload['functional_cookies'],
            }, request=request)
        except Exception:
            pass
        return {'message': 'Consent saved'}
    except Exception as e:
        try:
            log_event(supabase, action_type='cookie_consent', status='FAIL', metadata={'error': str(e)}, request=request)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail='Failed to save cookie consent')
