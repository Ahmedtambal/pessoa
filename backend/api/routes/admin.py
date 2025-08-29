from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
import os
import requests
from supabase import create_client, Client
# --- THIS IS A KEY PART OF THE FIX ---
# We are only importing BaseModel now, not EmailStr
from pydantic import BaseModel
from typing import List
import secrets
import string

from config.settings import settings
from .resume_analyzer import get_current_user, get_supabase_client
from services.utils.audit_logger import log_event
from time import time

# Small in-memory cache to reduce repeated DB role lookups when the settings page polls
_ADMIN_ROLE_CACHE: dict = {}
_ADMIN_ROLE_CACHE_TTL = 3  # seconds

# --- Pydantic Models ---
class UserUpdate(BaseModel):
    role: str

class InviteRequest(BaseModel):
    # --- THIS IS THE FIX ---
    # We now validate that 'invites' is a list of simple strings, not a complex EmailStr.
    # This removes the dependency on the faulty email-validator library for this step.
    invites: List[str]
    role: str

class DeleteOrgRequest(BaseModel):
    organization_name: str
class CreateInviteRequest(BaseModel):
    email: str
    role: str | None = 'MEMBER'
    expires_in_hours: int | None = 168

class InviteOut(BaseModel):
    code: str
    email: str
    role: str
    organization_name: str | None = None


router = APIRouter(prefix="/admin", tags=["Admin Management"])

# --- Supabase Admin Client Dependency ---
def get_supabase_admin_client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def admin_delete_auth_user(user_id: str):
    """Delete a user using Supabase Auth Admin HTTP API with the service role key.

    This avoids relying on a database-side SQL function which may not exist in some setups.
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
    headers = {
        'Authorization': f'Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}',
        'apikey': settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    resp = requests.delete(url, headers=headers)
    try:
        data = resp.json()
    except Exception:
        data = resp.text
    if not resp.ok:
        raise HTTPException(status_code=500, detail={"message": data})
    return data

# --- Admin-Only Dependency ---
async def is_admin_user(current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase_admin_client)):
    user_id = current_user.get('id')
    # Check the in-memory cache first to avoid hammering PostgREST when the UI retries rapidly.
    now = time()
    cache_entry = _ADMIN_ROLE_CACHE.get(user_id)
    if cache_entry and cache_entry[1] > now:
        role = cache_entry[0]
    else:
        response = supabase.table('profiles').select('role').eq('id', user_id).single().execute()
        if getattr(response, 'error', None):
            raise HTTPException(status_code=500, detail=str(response.error))
        role = response.data.get('role') if response and response.data else None
        _ADMIN_ROLE_CACHE[user_id] = (role, now + _ADMIN_ROLE_CACHE_TTL)

    if role != 'ADMIN':
        raise HTTPException(status_code=403, detail="Forbidden: Not an admin")
    return current_user
def _generate_invite_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@router.post('/invites', response_model=InviteOut, dependencies=[Depends(is_admin_user)])
async def create_invite(req: CreateInviteRequest, supabase: Client = Depends(get_supabase_admin_client), current_user: dict = Depends(get_current_user)):
    # Determine inviter's org
    org_name = None
    try:
        prof = supabase.table('profiles').select('organization_name, organization_id').eq('id', current_user.get('id')).single().execute()
        if prof and prof.data:
            org_name = prof.data.get('organization_name')
            org_id = prof.data.get('organization_id')
    except Exception:
        org_name = None
        org_id = None

    code = _generate_invite_code()
    payload = {
        'code': code,
        'email': req.email,
        'role': req.role or 'MEMBER',
        'organization_name': org_name,
        'organization_id': org_id,
        'created_by': current_user.get('id'),
    }
    if req.expires_in_hours and req.expires_in_hours > 0:
        try:
            from datetime import datetime, timedelta, timezone
            payload['expires_at'] = (datetime.now(timezone.utc) + timedelta(hours=req.expires_in_hours)).isoformat()
        except Exception:
            pass

    resp = supabase.table('invites').insert(payload).execute()
    if getattr(resp, 'error', None):
        raise HTTPException(status_code=500, detail=str(resp.error))
    return InviteOut(code=code, email=req.email, role=payload['role'], organization_name=org_name)

@router.get('/invites', dependencies=[Depends(is_admin_user)])
async def list_invites(supabase: Client = Depends(get_supabase_admin_client)):
    resp = supabase.table('invites').select('*').order('created_at', desc=True).execute()
    if getattr(resp, 'error', None):
        raise HTTPException(status_code=500, detail=str(resp.error))
    return resp.data or []

class RevokeInviteRequest(BaseModel):
    code: str

@router.post('/invites/revoke', dependencies=[Depends(is_admin_user)])
async def revoke_invite(req: RevokeInviteRequest, supabase: Client = Depends(get_supabase_admin_client)):
    resp = supabase.table('invites').update({'status': 'REVOKED'}).eq('code', req.code).eq('status', 'PENDING').execute()
    if getattr(resp, 'error', None):
        raise HTTPException(status_code=500, detail=str(resp.error))
    return {'message': 'Invite revoked'}



@router.get("/users", dependencies=[Depends(is_admin_user)])
async def list_users(supabase: Client = Depends(get_supabase_admin_client)):
    try:
        # Try the improved RPC function first
        response = supabase.rpc('get_users_with_profiles').execute()
        if getattr(response, 'error', None):
            print('[list_users] get_users_with_profiles error:', response.error)
            # Try the fallback RPC function
            response = supabase.rpc('get_profiles_only').execute()
            if getattr(response, 'error', None):
                print('[list_users] get_profiles_only error:', response.error)
                raise Exception(response.error)

        return response.data or []

    except Exception as e:
        frontend = os.getenv('FRONTEND_URL') or 'https://pessoa-frontend.onrender.com'
        print('[list_users] rpc error:', e)

        # Final fallback: direct profiles table query
        try:
            fallback = supabase.table('profiles').select('id, full_name, email, organization_name, role, created_at').execute()
            if getattr(fallback, 'error', None):
                print('[list_users] profiles fallback error:', fallback.error)
                raise Exception(fallback.error)

            return fallback.data or []

        except Exception as e2:
            print('[list_users] fallback profiles error:', e2)

            # Last resort: return empty list with error message
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Failed to list users",
                    "error": str(e2),
                    "suggestion": "Please run the database fix script: database_comprehensive_fix.sql"
                },
                headers={
                    'Access-Control-Allow-Origin': frontend,
                    'Access-Control-Allow-Credentials': 'true'
                },
            )

@router.put("/users/{user_id}", dependencies=[Depends(is_admin_user)])
async def update_user_role(user_id: str, update: UserUpdate, supabase: Client = Depends(get_supabase_admin_client)):
    response = supabase.table('profiles').update({'role': update.role}).eq('id', user_id).execute()
    return response.data

@router.delete("/users/{user_id}", dependencies=[Depends(is_admin_user)])
async def delete_user(user_id: str, supabase: Client = Depends(get_supabase_admin_client)):
    # Before deleting the auth user, check their profile role and organization.
    print(f"[delete_user] request for user_id={user_id}")
    try:
        profile_resp = supabase.table('profiles').select('role, organization_name').eq('id', user_id).single().execute()
        if getattr(profile_resp, 'error', None):
            print('[delete_user] profile lookup error:', profile_resp.error)
            raise HTTPException(status_code=500, detail=str(profile_resp.error))

        if not profile_resp or not profile_resp.data:
            # If there's no profile, still attempt to delete auth user but inform caller.
            print('[delete_user] no profile row found for user, proceeding to auth deletion')
            try:
                resp = admin_delete_auth_user(user_id)
                return {"message": "User deleted (no profile existed)", "data": resp}
            except HTTPException:
                raise
            except Exception as e:
                print('[delete_user] auth.delete_user error:', e)
                raise HTTPException(status_code=500, detail=str(e))

        role = profile_resp.data.get('role')
        org_name = profile_resp.data.get('organization_name')

        # If this user is an ADMIN and belongs to an organization, ensure there is at least
        # one other admin before removing them. If they are the last admin, delete the org too.
        if role == 'ADMIN' and org_name:
            admins_resp = supabase.table('profiles').select('id').eq('organization_name', org_name).eq('role', 'ADMIN').execute()
            if getattr(admins_resp, 'error', None):
                print('[delete_user] admins lookup error:', admins_resp.error)
                raise HTTPException(status_code=500, detail=str(admins_resp.error))

            other_admins = [a for a in (admins_resp.data or []) if a.get('id') != user_id]
            if not other_admins:
                # No other admins remain — remove organization data.
                try:
                    print(f"[delete_user] last admin for org '{org_name}', deleting organization data")
                    supabase.rpc('delete_organization_data', {'org_name': org_name}).execute()
                except Exception as e:
                    # Log and continue to attempt user deletion; surface error if needed.
                    print(f"Failed to delete organization '{org_name}' while deleting last admin: {e}")

        try:
            response = admin_delete_auth_user(user_id)
            print('[delete_user] auth.delete_user response:', response)
            return {"message": "User deleted successfully", "data": response}
        except HTTPException:
            raise
        except Exception as e:
            print('[delete_user] auth.delete_user exception:', e)
            raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print('[delete_user] unexpected error:', e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/profiles/{user_id}', dependencies=[Depends(is_admin_user)])
async def delete_profile(user_id: str, supabase: Client = Depends(get_supabase_admin_client)):
    """Delete a profile row. If the profile is an ADMIN and the last admin in the organization,
    delete the organization as well.
    """
    try:
        print(f"[delete_profile] request for user_id={user_id}")
        profile_resp = supabase.table('profiles').select('role, organization_name').eq('id', user_id).single().execute()
        if getattr(profile_resp, 'error', None):
            print('[delete_profile] profile lookup error:', profile_resp.error)
            raise HTTPException(status_code=500, detail=str(profile_resp.error))

        if not profile_resp or not profile_resp.data:
            print('[delete_profile] profile not found')
            raise HTTPException(status_code=404, detail='Profile not found')

        role = profile_resp.data.get('role')
        org_name = profile_resp.data.get('organization_name')

        # Delete the profile row
        del_resp = supabase.table('profiles').delete().eq('id', user_id).execute()
        if getattr(del_resp, 'error', None):
            print('[delete_profile] delete error:', del_resp.error)
            raise HTTPException(status_code=500, detail=str(del_resp.error))

        # If the deleted profile was an ADMIN, check for other admins in the org
        if role == 'ADMIN' and org_name:
            admins_resp = supabase.table('profiles').select('id').eq('organization_name', org_name).eq('role', 'ADMIN').execute()
            if getattr(admins_resp, 'error', None):
                print('[delete_profile] admins lookup error:', admins_resp.error)
                raise HTTPException(status_code=500, detail=str(admins_resp.error))

            remaining_admins = admins_resp.data or []
            if not remaining_admins:
                # No admins left — delete the organization data via RPC
                try:
                    print(f"[delete_profile] last admin removed for org '{org_name}', deleting organization data")
                    supabase.rpc('delete_organization_data', {'org_name': org_name}).execute()
                except Exception as e:
                    print(f"Failed to delete organization '{org_name}' after removing last admin profile: {e}")

        return { 'message': 'Profile deleted', 'data': del_resp.data }
    except HTTPException:
        raise
    except Exception as e:
        print('[delete_profile] unexpected error:', e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invite", dependencies=[Depends(is_admin_user)])
async def invite_user_by_email(
    http_request: Request,
    request: InviteRequest,
    supabase: Client = Depends(get_supabase_admin_client),
    current_user: dict = Depends(get_current_user),
):
    invited_users = []
    errors = []

    # Attempt to read the inviting admin's organization name so we can attach it to the invite metadata.
    org_name = None
    try:
        profile_resp = (
            supabase
            .table('profiles')
            .select('organization_name, organization_id')
            .eq('id', current_user.get('id'))
            .single()
            .execute()
        )
        if profile_resp and profile_resp.data:
            org_name = profile_resp.data.get('organization_name')
            org_id = profile_resp.data.get('organization_id')
    except Exception:
        # non-fatal; proceed without org metadata if lookup fails
        org_name = None
        org_id = None

    # Derive production-safe redirect target
    frontend = os.getenv('FRONTEND_URL') or 'https://pessoa-frontend.onrender.com'
    redirect_target = f"{frontend.rstrip('/')}/invite-signup"

    for email in request.invites:
        try:
            # Pass an options dict including redirect URL and invite metadata (inviter id + organization)
            options = {"redirect_to": redirect_target, "data": {"invited_by": current_user.get('id')}}
            if org_name:
                options['data']['organization_name'] = org_name
            if 'org_id' not in locals():
                org_id = None
            if org_id:
                options['data']['organization_id'] = org_id

            response = supabase.auth.admin.invite_user_by_email(email, options)
            invited_users.append(response)
            try:
                log_event(
                    supabase,
                    event_type='invite_sent',
                    user_id=current_user.get('id'),
                    email=email,
                    organization_name=org_name,
                    details={'redirect_to': options.get('redirect_to')},
                    request=http_request,
                )
            except Exception:
                pass
        except Exception as e:
            errors.append({"email": email, "error": str(e)})
            print(f"INVITE ERROR for {email}: {str(e)}")

    if errors:
        print("INVITE ERRORS SUMMARY:", errors)
        raise HTTPException(status_code=400, detail={"message": "Some invitations failed. Please check the email addresses.", "errors": errors})

    return {"message": "Invitations sent successfully", "data": invited_users}

@router.post("/organization/delete", dependencies=[Depends(is_admin_user)])
async def delete_organization(request: DeleteOrgRequest, supabase: Client = Depends(get_supabase_admin_client)):
    try:
        resp = supabase.rpc('delete_organization_data', {'org_name': request.organization_name}).execute()
        if getattr(resp, 'error', None):
            raise Exception(resp.error)
        return {"message": f"Successfully deleted organization '{request.organization_name}' and all associated data."}
    except Exception as e:
        # If the database function is missing (common on some Supabase setups),
        # fall back to a best-effort server-side cleanup: delete profiles and auth users.
        msg = str(e)
        print(f"[delete_organization] RPC failed: {msg}")
        # Some Supabase instances may not have the same helper functions/tables; attempt a best-effort cleanup
        if 'admin_delete_user' in msg or 'function auth.admin_delete_user' in msg or '42883' in msg or 'column "user_id" does not exist' in msg:
            try:
                # Fetch all user ids in the organization
                profiles_resp = supabase.table('profiles').select('id').eq('organization_name', request.organization_name).execute()
                ids = [p.get('id') for p in (profiles_resp.data or [])]
                print(f"[delete_organization] fallback will delete profiles and auth users: {ids}")

                failed_auth_deletes = []
                for uid in ids:
                    try:
                        supabase.table('profiles').delete().eq('id', uid).execute()
                    except Exception as ex:
                        print(f"[delete_organization] failed to delete profile {uid}: {ex}")
                    try:
                        admin_delete_auth_user(uid)
                    except Exception as ex:
                        print(f"[delete_organization] failed to delete auth user {uid}: {ex}")
                        failed_auth_deletes.append({"id": uid, "error": str(ex)})

                # Attempt to delete an organizations row if the table exists
                try:
                    org_check = supabase.table('organizations').select('name').limit(1).execute()
                    if getattr(org_check, 'error', None):
                        err_msg = str(org_check.error)
                        # common PostgREST message when a table doesn't exist
                        if 'Could not find the table' in err_msg or 'PGRST205' in err_msg:
                            print('[delete_organization] organizations table not present, skipping row delete')
                        else:
                            print(f"[delete_organization] unexpected error when checking organizations table: {err_msg}")
                    else:
                        supabase.table('organizations').delete().eq('name', request.organization_name).execute()
                except Exception as ex:
                    print(f"[delete_organization] failed to delete organizations row: {ex}")

                result = {"message": f"Fallback cleanup completed for organization '{request.organization_name}'."}
                if failed_auth_deletes:
                    result['failed_auth_deletes'] = failed_auth_deletes
                # Ensure CORS so the browser receives Access-Control-Allow-Origin even after an error path
                frontend = os.getenv('FRONTEND_URL') or 'https://pessoa-frontend.onrender.com'
                return JSONResponse(status_code=200, content=result, headers={
                    'Access-Control-Allow-Origin': frontend,
                    'Access-Control-Allow-Credentials': 'true'
                })
            except Exception as ex2:
                print(f"[delete_organization] fallback failed: {ex2}")
                raise HTTPException(status_code=500, detail=str(ex2))

        # If it's a different error, re-raise so the client can see it
        raise HTTPException(status_code=500, detail=str(e))


class ProfileUpsertRequest(BaseModel):
    full_name: str | None = None
    organization_name: str | None = None
    # Optionally allow passing email (will be validated from auth user)
    email: str | None = None


@router.post('/profile/upsert')
async def upsert_my_profile(request: ProfileUpsertRequest, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase_admin_client)):
    """Upsert the authenticated user's profile using the admin client (service role).

    This endpoint exists because browser clients are subject to Row Level Security
    and may get 403 when trying to upsert profile rows directly. The admin client
    uses the service role key and bypasses RLS to safely create or update the
    profiles row for the signed-in user.
    """
    try:
        user_id = current_user.get('id')
        # Read email and invite metadata from the auth user object (more trustworthy than client input)
        auth_email = current_user.get('email') or current_user.get('user_metadata', {}).get('email')
        invited_org_name = current_user.get('user_metadata', {}).get('organization_name')
        invited_org_id = current_user.get('user_metadata', {}).get('organization_id')

        payload = {'id': user_id}
        if request.full_name:
            payload['full_name'] = request.full_name
        # Persist email on the profile if available
        if auth_email:
            payload['email'] = auth_email
        elif request.email:
            payload['email'] = request.email

        # Organization assignment priority:
        # 1) Invite metadata (organization_id/name) from auth user
        # 2) Explicit organization_name provided by the caller
        org_name_to_use = invited_org_name or request.organization_name
        if org_name_to_use:
            payload['organization_name'] = org_name_to_use

        # Log the upsert attempt for debugging misassigned organizations
        print(f"[upsert_my_profile] upserting profile for user_id={user_id} with payload={payload}")

        # If we have an org id in invite metadata, try to set it
        if invited_org_id:
            payload['organization_id'] = invited_org_id

        # Perform the profile upsert
        response = supabase.table('profiles').upsert(payload).execute()
        if getattr(response, 'error', None):
            raise HTTPException(status_code=500, detail=str(response.error))

        # Audit profile update
        try:
            from services.utils.audit_logger import log_event
            log_event(supabase, action_type='profile_update', user_id=user_id, metadata={'full_name': request.full_name, 'organization_name': request.organization_name})
        except Exception:
            pass

        # If we have an organization_name, ensure the organizations
        # table contains a row for it. This keeps explicit org records in sync
        # with profiles that reference them. If the organizations table does
        # not exist on this Supabase instance, catch and ignore the error.
        if org_name_to_use:
            try:
                # Upsert organization row and attempt to set organization_id if missing
                org_resp = supabase.table('organizations').upsert({'name': org_name_to_use}).execute()
                if getattr(org_resp, 'error', None):
                    print('[upsert_my_profile] organizations.upsert error:', org_resp.error)
                else:
                    try:
                        # Lookup id and ensure profile has it
                        lookup = supabase.table('organizations').select('id').eq('name', org_name_to_use).single().execute()
                        if lookup and getattr(lookup, 'data', None):
                            org_id = lookup.data.get('id')
                            if org_id:
                                supabase.table('profiles').update({'organization_id': org_id}).eq('id', user_id).execute()
                    except Exception as _:
                        pass
            except Exception as e:
                print('[upsert_my_profile] could not upsert organizations row (table may be missing):', e)

        return {'message': 'Profile upserted', 'data': response.data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/account/delete')
async def delete_my_account(http_request: Request, current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase_admin_client)):
    """Delete the current authenticated user's profile and auth user.

    If the user is an ADMIN and the last admin for their organization, delete the organization as well.
    """
    try:
        user_id = current_user.get('id')

        # Fetch profile to know role and organization
        profile_resp = supabase.table('profiles').select('role, organization_name').eq('id', user_id).single().execute()
        if getattr(profile_resp, 'error', None):
            raise HTTPException(status_code=500, detail=str(profile_resp.error))

        role = profile_resp.data.get('role') if profile_resp and profile_resp.data else None
        org_name = profile_resp.data.get('organization_name') if profile_resp and profile_resp.data else None

        # Delete profile row if exists
        try:
            supabase.table('profiles').delete().eq('id', user_id).execute()
        except Exception:
            # ignore profile delete errors and continue to delete auth user
            pass

        # If this user was an ADMIN, ensure org cleanup when they are last admin
        if role == 'ADMIN' and org_name:
            admins_resp = supabase.table('profiles').select('id').eq('organization_name', org_name).eq('role', 'ADMIN').execute()
            if not (admins_resp.data and any(a.get('id') != user_id for a in admins_resp.data)):
                # No other admins remain — remove organization data.
                try:
                    supabase.rpc('delete_organization_data', {'org_name': org_name}).execute()
                except Exception:
                    # Non-fatal; proceed to delete the auth user
                    pass

        # Delete the auth user using admin client
        try:
            admin_delete_auth_user(user_id)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        try:
            log_event(
                supabase,
                event_type='account_delete',
                user_id=user_id,
                organization_name=org_name,
                details={'role': role},
                request=http_request,
            )
        except Exception:
            pass
        return { 'message': 'Account and profile deleted' }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))