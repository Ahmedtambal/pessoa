from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import requests
from supabase import create_client, Client
from typing import Optional
from config.settings import settings

router = APIRouter(prefix="", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    organization_name: Optional[str] = None


@router.post('/register')
def register_user(req: RegisterRequest):
    """Create a new Supabase auth user using the service role key, upsert profile and organization.

    Security: This endpoint uses the service role key to create a user. It must not return any secrets.
    The endpoint will NOT sign the user in; client must sign in after email confirmation.
    """
    # Basic validation
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail='Password must be at least 6 characters')

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

    # Log the raw response from Supabase admin API for debugging (no secrets)
    try:
        print('[register_user] supabase admin response status:', resp.status_code)
        print('[register_user] supabase admin response body:', data)
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
        try:
            # Check if org already exists
            org_check = supabase.table('organizations').select('id').eq('name', org_name).single().execute()
            if not org_check.data:
                # create org and make this user ADMIN
                insert_resp = supabase.table('organizations').insert({'name': org_name}).execute()
                org_id = None
                if getattr(insert_resp, 'data', None):
                    org_id = insert_resp.data[0].get('id')
                role = 'ADMIN'
            else:
                # org exists; find its id and check if it has any admins
                org_id = org_check.data.get('id') if isinstance(org_check.data, dict) else (org_check.data[0].get('id') if org_check.data else None)
                # If organization has no admins, promote this user to ADMIN
                try:
                    admins_resp = supabase.table('profiles').select('id').eq('organization_id', org_id).eq('role', 'ADMIN').limit(1).execute()
                    has_admins = bool(admins_resp.data)
                except Exception:
                    has_admins = False
                role = 'ADMIN' if not has_admins else 'MEMBER'
        except Exception as e:
            # If organizations table missing or other error, continue but log
            print('[register_user] org upsert error:', e)
        profile_payload['organization_name'] = org_name
        # attach organization_id when available
        try:
            if 'org_id' in locals() and org_id:
                profile_payload['organization_id'] = org_id
            else:
                # try to load org id by name as fallback
                lookup = supabase.table('organizations').select('id').eq('name', org_name).single().execute()
                if getattr(lookup, 'data', None):
                    profile_payload['organization_id'] = lookup.data.get('id') if isinstance(lookup.data, dict) else (lookup.data[0].get('id') if lookup.data else None)
        except Exception:
            pass

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

    return {'message': 'User created. Please check your email to confirm and then sign in.', 'user': user_info}
