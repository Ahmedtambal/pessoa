from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form, Body, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from supabase import create_client, Client
from pydantic import BaseModel
from config.settings import settings
from services.resume_service import resume_service
from services.utils.audit_logger import log_event
from time import time
import os
import mimetypes

# Simple in-memory TTL cache for token -> user lookups to avoid repeat network calls
# Keyed by raw JWT; small TTL reduces latency for rapid UI requests (e.g. settings page)
_USER_CACHE: dict = {}
_USER_CACHE_TTL = 5  # seconds

# Security constants
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx'}

def validate_file_security(file: UploadFile) -> None:
    """
    Validate file upload for security concerns:
    - File size limit
    - MIME type validation
    - File extension validation
    - Content type spoofing protection
    """
    # Check file size
    if hasattr(file, 'size') and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF, DOC, and DOCX files are allowed"
        )

    # Validate file extension
    _, ext = os.path.splitext(file.filename or '')
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Only .pdf, .doc, and .docx files are allowed"
        )

    # Additional MIME type validation based on file extension
    expected_mime = mimetypes.guess_type(file.filename or '')[0]
    if expected_mime and expected_mime != file.content_type:
        raise HTTPException(
            status_code=400,
            detail="File type mismatch detected. Possible security risk"
        )

# --- Pydantic model for the delete request body ---
class DeleteRequest(BaseModel):
    # IDs are stored as UUIDs in the database; accept strings so both UUIDs and numeric ids work.
    ids: List[str]

# --- Router Definition ---
router = APIRouter(prefix="/resumes", tags=["Resume Analysis & Bank"])
supabase_bearer_scheme = HTTPBearer()

# --- Supabase Client Dependency ---
def get_supabase_client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# --- Reusable Dependency to Get and Validate the User from JWT ---
async def get_current_user(
    supabase: Client = Depends(get_supabase_client), 
    token: HTTPAuthorizationCredentials = Depends(supabase_bearer_scheme)
) -> dict:
    """
    Validates the JWT token from the Authorization header and returns the user object.
    Raises a 401 Unauthorized error if the token is invalid or expired.
    """
    try:
        # TTL cache check
        cache_entry = _USER_CACHE.get(token.credentials)
        now = time()
        if cache_entry and cache_entry[1] > now:
            return cache_entry[0]

        user_response = supabase.auth.get_user(jwt=token.credentials)
        user = user_response.user
        if not user:
            raise HTTPException(status_code=401, detail="User not found or token is invalid")

        user_dict = user.dict()
        # store in cache
        _USER_CACHE[token.credentials] = (user_dict, now + _USER_CACHE_TTL)
        return user_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {e}")

# --- API Endpoints ---

@router.post("/compare")
async def compare_cvs_and_jd(
    jd: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    request: Request | None = None,
):
    try:
        analysis_result = resume_service.compare_cvs_to_jd(jd, files)
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            log_event(
                supabase,
                event_type='cv_compare',
                user_id=current_user.get('id'),
                organization_name=None,
                details={'files': [f.filename for f in files], 'jd_len': len(jd or '')},
                request=request,
            )
        except Exception:
            pass
        return {"analysis": analysis_result}
    except Exception as e:
        print(f"Error during CV comparison: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred during analysis: {str(e)}")


@router.post("/upload")
async def upload_and_process_resume(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user),
    request: Request | None = None,
):
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID could not be determined from token.")

        # Extract profile data from the CV
        profile_data = resume_service.extract_profile_from_cv(file)
        if not profile_data or not profile_data.get('name'):
            raise HTTPException(status_code=400, detail="Could not extract key information from CV.")

        # Read file bytes for storage
        file_bytes = await file.read()
        
        # Create user-specific storage path
        storage_path = f"{user_id}/{file.filename}"
        
        # Upload to Supabase Storage
        try:
            supabase.storage.from_("cv_uploads").upload(
                path=storage_path, 
                file=file_bytes, 
                file_options={"content-type": file.content_type, "upsert": "true"}
            )
        except Exception as storage_error:
            print(f"Storage upload error: {storage_error}")
            raise HTTPException(status_code=500, detail="Failed to upload file to storage")

        # Create database record with both user_id and profile_id
        db_record = {
            "user_id": user_id,        # Legacy support
            "profile_id": user_id,     # Preferred - links to profiles table
            "file_name": file.filename,
            "storage_path": storage_path,
            "name": profile_data.get('name'),
            "job_title": profile_data.get('job_title'),
            "email": profile_data.get('email'),
            "phone_number": profile_data.get('phone_number'),
            "location": profile_data.get('location'),
            "work_experience_summary": profile_data.get('work_experience_summary'),
            "skills_summary": profile_data.get('skills_summary'),
            "education_summary": profile_data.get('education_summary'),
            "full_extracted_text": profile_data.get('full_extracted_text'),
        }
        
        # Try inserting the record with proper error handling
        def _attempt_insert(record):
            resp = supabase.table('resumes').insert(record).execute()
            return resp

        response = None
        remaining_record = dict(db_record)
        max_retries = len(remaining_record)
        import re

        for _ in range(max_retries + 1):
            try:
                response = _attempt_insert(remaining_record)
                if getattr(response, 'error', None):
                    # Some PostgREST errors are objects; stringify for inspection
                    err_msg = str(response.error)
                    raise Exception(err_msg)

                # success
                break
            except Exception as insert_err:
                err_text = str(insert_err)
                print(f"[upload_and_process_resume] insert error: {err_text}")
                # Look for common indications of missing columns
                # e.g. "Could not find the 'education_summary' column of 'resumes' in the schema cache"
                m = re.search(r"Could not find the '([a-zA-Z0-9_]+)' column", err_text)
                if not m:
                    # alternate pattern: column "user_id" does not exist
                    m = re.search(r'column "([a-zA-Z0-9_]+)" does not exist', err_text)

                if m:
                    col = m.group(1)
                    if col in remaining_record:
                        print(f"[upload_and_process_resume] removing missing column '{col}' and retrying")
                        remaining_record.pop(col, None)
                        continue

                # If we couldn't parse a missing-column error, or no recoverable keys remain,
                # surface a clear error to the client.
                raise HTTPException(status_code=500, detail=f"Failed to save resume metadata: {err_text}")

        if not response or not getattr(response, 'data', None):
            raise HTTPException(status_code=500, detail="Failed to save resume metadata to the database.")

        row = response.data[0]
        try:
            log_event(
                supabase,
                event_type='resume_upload',
                user_id=current_user.get('id'),
                organization_name=None,
                details={'resume_id': row.get('id'), 'file_name': file.filename},
                request=request,
            )
        except Exception:
            pass
        return row

    except Exception as e:
        print(f"AN ERROR OCCURRED DURING UPLOAD: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.get("/")
async def get_all_resumes(
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get('id')

    try:
        # First check if resumes table exists
        supabase.table('resumes').select('id').limit(1).execute()

        # If table exists, proceed with normal fetching
        # First try profile_id (newer, proper foreign key)
        response = supabase.table('resumes').select("*").eq('profile_id', user_id).order('uploaded_at', desc=True).execute()
        if getattr(response, 'error', None):
            raise Exception(response.error)

        # If no rows found, try the older user_id column for backwards compatibility
        if not response.data:
            response = supabase.table('resumes').select("*").eq('user_id', user_id).order('uploaded_at', desc=True).execute()
            if getattr(response, 'error', None):
                raise Exception(response.error)

        # If still no data, try a broader query to catch any resumes that might exist
        if not response.data:
            response = supabase.table('resumes').select("*").or_(f'profile_id.eq.{user_id},user_id.eq.{user_id}').order('uploaded_at', desc=True).execute()
            if getattr(response, 'error', None):
                raise Exception(response.error)

        return response.data or []

    except Exception as e:
        error_msg = str(e).lower()
        if 'relation "public.resumes" does not exist' in error_msg or 'table' in error_msg and 'does not exist' in error_msg:
            print("[get_all_resumes] Resumes table doesn't exist yet")
            return []
        else:
            print("[get_all_resumes] Error fetching resumes:", str(e))
            raise HTTPException(status_code=500, detail="Failed to fetch resumes")


@router.delete("/")
async def delete_resumes(
    request: DeleteRequest | None = Body(None),
    ids: str | None = Query(None, description="Comma-separated list of resume ids to delete"),
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    """Delete resumes belonging to the current user.

    Accepts either a JSON body: {"ids": ["id1","id2"]} or a query param: ?ids=id1,id2
    This avoids 422 errors when clients send UUID strings or when some clients cannot send a
    request body with DELETE.
    """
    ids_to_delete = []

    # Prefer JSON body if provided
    if request and getattr(request, 'ids', None):
        ids_to_delete = request.ids
    elif ids:
        # parse comma separated ids from query param
        ids_to_delete = [s.strip() for s in ids.split(',') if s.strip()]

    if not ids_to_delete:
        raise HTTPException(status_code=400, detail="No resume IDs provided. Provide JSON body {'ids':[...]} or ?ids=id1,id2")

    user_id = current_user.get('id')

    try:
        # First check if resumes table exists
        supabase.table('resumes').select('id').limit(1).execute()

        # If table exists, proceed with deletion
        deleted_ids = []

        # First attempt delete by profile_id (newer, proper foreign key)
        try:
            resp1 = supabase.table('resumes').delete().in_('id', ids_to_delete).eq('profile_id', user_id).execute()
            if getattr(resp1, 'error', None):
                print("[delete_resumes] Error deleting by profile_id:", resp1.error)
            else:
                deleted_ids.extend([r.get('id') for r in (resp1.data or []) if r.get('id')])
        except Exception as e:
            print("[delete_resumes] Exception deleting by profile_id:", str(e))

        # Delete any remaining ids using user_id (legacy column)
        remaining = [i for i in ids_to_delete if i not in deleted_ids]
        if remaining:
            try:
                resp2 = supabase.table('resumes').delete().in_('id', remaining).eq('user_id', user_id).execute()
                if getattr(resp2, 'error', None):
                    print("[delete_resumes] Error deleting by user_id:", resp2.error)
                else:
                    deleted_ids.extend([r.get('id') for r in (resp2.data or []) if r.get('id')])
            except Exception as e:
                print("[delete_resumes] Exception deleting by user_id:", str(e))

        # If still have remaining IDs, try a more flexible approach
        remaining = [i for i in ids_to_delete if i not in deleted_ids]
        if remaining:
            try:
                # Try to delete without user filtering (for edge cases)
                resp3 = supabase.table('resumes').delete().in_('id', remaining).execute()
                if getattr(resp3, 'error', None):
                    print("[delete_resumes] Error deleting remaining IDs:", resp3.error)
                else:
                    deleted_ids.extend([r.get('id') for r in (resp3.data or []) if r.get('id')])
            except Exception as e:
                print("[delete_resumes] Exception deleting remaining IDs:", str(e))

        return {"deleted_ids": deleted_ids}

    except Exception as e:
        error_msg = str(e).lower()
        if 'relation "public.resumes" does not exist' in error_msg or 'table' in error_msg and 'does not exist' in error_msg:
            print("[delete_resumes] Resumes table doesn't exist yet")
            return {"deleted_ids": [], "message": "Database not yet configured"}
        else:
            print("[delete_resumes] Error deleting resumes:", str(e))
            raise HTTPException(status_code=500, detail="Failed to delete resumes")