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
        'email_confirm': False,
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

    # If organization provided: create organization row if missing and determine role
    role = 'MEMBER'
    if req.organization_name:
        org_name = req.organization_name.strip()
        try:
            # Check if org already exists
            org_check = supabase.table('organizations').select('id').eq('name', org_name).single().execute()
            if not org_check.data:
                # create org
                supabase.table('organizations').insert({'name': org_name}).execute()
                # first user in this org becomes ADMIN
                role = 'ADMIN'
            else:
                # org exists; keep role MEMBER
                role = 'MEMBER'
        except Exception as e:
            # If organizations table missing or other error, continue but log
            print('[register_user] org upsert error:', e)
        profile_payload['organization_name'] = org_name

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

    return {'message': 'User created. Please check your email to confirm and then sign in.'}
