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

    return {'message': 'User created. Please check your email to confirm and then sign in.', 'user': user_info}
