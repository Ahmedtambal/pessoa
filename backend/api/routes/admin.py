from fastapi import APIRouter, HTTPException, Depends
import requests
from supabase import create_client, Client
# --- THIS IS A KEY PART OF THE FIX ---
# We are only importing BaseModel now, not EmailStr
from pydantic import BaseModel
from typing import List

from config.settings import settings
from .resume_analyzer import get_current_user, get_supabase_client

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
    response = supabase.table('profiles').select('role').eq('id', user_id).single().execute()
    if not response.data or response.data.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Forbidden: Not an admin")
    return current_user

# --- API Endpoints ---
@router.get("/users", dependencies=[Depends(is_admin_user)])
async def list_users(supabase: Client = Depends(get_supabase_admin_client)):
    response = supabase.rpc('get_users_with_profiles').execute()
    return response.data

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
    request: InviteRequest,
    supabase: Client = Depends(get_supabase_admin_client),
    current_user: dict = Depends(get_current_user),
):
    invited_users = []
    errors = []

    # Attempt to read the inviting admin's organization name so we can attach it to the invite metadata.
    org_name = None
    try:
        profile_resp = supabase.table('profiles').select('organization_name').eq('id', current_user.get('id')).single().execute()
        if profile_resp and profile_resp.data:
            org_name = profile_resp.data.get('organization_name')
    except Exception:
        # non-fatal; proceed without org metadata if lookup fails
        org_name = None

    for email in request.invites:
        try:
            # Pass an options dict including redirect URL and invite metadata (inviter id + organization)
            options = {"redirect_to": "http://localhost:5173/invite-signup", "data": {"invited_by": current_user.get('id')}}
            if org_name:
                options['data']['organization_name'] = org_name

            response = supabase.auth.admin.invite_user_by_email(email, options)
            invited_users.append(response)
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
        if 'admin_delete_user' in msg or 'function auth.admin_delete_user' in msg or '42883' in msg:
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
                return result
            except Exception as ex2:
                print(f"[delete_organization] fallback failed: {ex2}")
                raise HTTPException(status_code=500, detail=str(ex2))

        # If it's a different error, re-raise so the client can see it
        raise HTTPException(status_code=500, detail=str(e))


class ProfileUpsertRequest(BaseModel):
    full_name: str | None = None
    organization_name: str | None = None


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
        payload = {'id': user_id}
        if request.full_name:
            payload['full_name'] = request.full_name
        if request.organization_name:
            payload['organization_name'] = request.organization_name

        # Log the upsert attempt for debugging misassigned organizations
        print(f"[upsert_my_profile] upserting profile for user_id={user_id} with payload={payload}")

        # Perform the profile upsert
        response = supabase.table('profiles').upsert(payload).execute()
        if getattr(response, 'error', None):
            raise HTTPException(status_code=500, detail=str(response.error))

        # If the caller provided an organization_name, ensure the organizations
        # table contains a row for it. This keeps explicit org records in sync
        # with profiles that reference them. If the organizations table does
        # not exist on this Supabase instance, catch and ignore the error.
        if request.organization_name:
            try:
                org_resp = supabase.table('organizations').upsert({'name': request.organization_name}).execute()
                if getattr(org_resp, 'error', None):
                    print('[upsert_my_profile] organizations.upsert error:', org_resp.error)
            except Exception as e:
                print('[upsert_my_profile] could not upsert organizations row (table may be missing):', e)

        return {'message': 'Profile upserted', 'data': response.data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/account/delete')
async def delete_my_account(current_user: dict = Depends(get_current_user), supabase: Client = Depends(get_supabase_admin_client)):
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

        return { 'message': 'Account and profile deleted' }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))