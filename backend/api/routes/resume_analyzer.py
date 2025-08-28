from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form, Body, Query, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from supabase import create_client, Client
from pydantic import BaseModel
from config.settings import settings
from services.resume_service import resume_service
from time import time
from fastapi import BackgroundTasks
import os
import uuid
from services.audit_service import log_audit
from services.job_queue import enqueue_job, get_redis
from services import tasks as job_tasks

# Simple in-memory TTL cache for token -> user lookups to avoid repeat network calls
# Keyed by raw JWT; small TTL reduces latency for rapid UI requests (e.g. settings page)
_USER_CACHE: dict = {}
_USER_CACHE_TTL = 5  # seconds

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


ALLOWED_EXT = {'.pdf', '.docx', '.txt'}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB

def validate_upload_file(upload: UploadFile):
    name = upload.filename or ''
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail='Invalid file type')
    # probe size
    data = upload.file.read(MAX_BYTES + 1)
    upload.file.seek(0)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail='File too large')

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
    current_user: dict = Depends(get_current_user)
):
    try:
        analysis_result = resume_service.compare_cvs_to_jd(jd, files)
        return {"analysis": analysis_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during analysis: {str(e)}")


@router.post('/compare-async')
async def compare_cvs_and_jd_async(
    background_tasks: BackgroundTasks,
    jd: str = Form(...),
    files: List[UploadFile] = File(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    # Validate and store files, prepare cv_texts
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid user')

        cv_texts = []
        storage_paths = []
        for f in files:
            validate_upload_file(f)
            raw_text = ''
            try:
                # extract_profile_from_cv can accept UploadFile but may read the file; ensure we pass a copy
                raw = resume_service.extract_profile_from_cv(file=f)
                raw_text = raw.get('full_extracted_text') if raw else ''
            except Exception:
                # fallback to text extractor
                from services.utils.file_extractor import extract_text_from_file
                # file.file is a SpooledTemporaryFile; seek to start
                try:
                    f.file.seek(0)
                except Exception:
                    pass
                raw_text = extract_text_from_file(f)

            storage_path = f"{user_id}/{uuid.uuid4()}_{f.filename}"
            # read file bytes safely
            try:
                f.file.seek(0)
            except Exception:
                pass
            file_bytes = f.file.read()
            supabase.storage.from_("cv_uploads").upload(path=storage_path, file=file_bytes, file_options={"content-type": f.content_type, "upsert": "true"})
            storage_paths.append(storage_path)
            cv_texts.append((f.filename or 'unknown', raw_text))

        # Create a job record in DB
        job_id = str(uuid.uuid4())
        job_payload = {
            'id': job_id,
            'user_id': user_id,
            'status': 'queued',
            'job_type': 'compare_cvs',
            'input': {'jd': jd, 'storage_paths': storage_paths},
        }
        # attempt insert
        supabase.table('jobs').insert(job_payload).execute()
        try:
            log_audit(user_id, 'job_created', model=None, details={'job_id': job_id, 'type': 'compare_cvs'})
        except Exception:
            pass

        # If Redis is configured, enqueue an RQ job; otherwise fall back to BackgroundTasks
        try:
            redis_conn = get_redis()
        except Exception:
            redis_conn = None

        if redis_conn:
            # enqueue an RQ job that calls our task wrapper
            try:
                enqueue_job(job_tasks.task_compare_texts, user_id, {'texts': cv_texts, 'jd': jd, 'storage_paths': storage_paths, 'job_id': job_id})
            except Exception as e:
                print('[compare-async] enqueue to RQ failed, falling back to BackgroundTasks:', e)
                # fallback to BackgroundTasks
                def _worker(jid, jd_text, cvs):
                    try:
                        result = resume_service.compare_texts_to_jd(jd_text, cvs)
                        supabase.table('jobs').update({'status': 'done', 'result': {'analysis': result}}).eq('id', jid).execute()
                        try:
                            log_audit(user_id=user_id, action='compare_cvs_async_completed', model='gpt-4o-mini', prompt=jd_text[:2000], output=(str(result)[:8000] if result else None), details={'job_id': jid})
                        except Exception:
                            pass
                    except Exception as e:
                        supabase.table('jobs').update({'status': 'failed', 'error': str(e)}).eq('id', jid).execute()

                background_tasks.add_task(_worker, job_id, jd, cv_texts)
        else:
            # No Redis: run via BackgroundTasks (existing approach)
            def _worker(jid, jd_text, cvs):
                try:
                    result = resume_service.compare_texts_to_jd(jd_text, cvs)
                    supabase.table('jobs').update({'status': 'done', 'result': {'analysis': result}}).eq('id', jid).execute()
                    try:
                        log_audit(user_id=user_id, action='compare_cvs_async_completed', model='gpt-4o-mini', prompt=jd_text[:2000], output=(str(result)[:8000] if result else None), details={'job_id': jid})
                    except Exception:
                        pass
                except Exception as e:
                    supabase.table('jobs').update({'status': 'failed', 'error': str(e)}).eq('id', jid).execute()

            background_tasks.add_task(_worker, job_id, jd, cv_texts)

        return JSONResponse(status_code=202, content={'job_id': job_id, 'status': 'queued'})
    except HTTPException:
        raise
    except Exception as e:
        print('[compare-async] error:', e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/jobs/{job_id}')
async def get_job(job_id: str, supabase: Client = Depends(get_supabase_client), current_user: dict = Depends(get_current_user)):
    try:
        resp = supabase.table('jobs').select('*').eq('id', job_id).single().execute()
        if getattr(resp, 'error', None):
            raise HTTPException(status_code=404, detail='Job not found')
        job = resp.data
        # ensure the requesting user owns the job or is admin
        if job.get('user_id') != current_user.get('id'):
            # check admin via profiles
            prof = supabase.table('profiles').select('role').eq('id', current_user.get('id')).single().execute()
            if not (prof and prof.data and prof.data.get('role') == 'ADMIN'):
                raise HTTPException(status_code=403, detail='Forbidden')
        return job
    except HTTPException:
        raise
    except Exception as e:
        print('[get_job] error:', e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_and_process_resume(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    try:
        user_id = current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID could not be determined from token.")

        profile_data = resume_service.extract_profile_from_cv(file)
        if not profile_data or not profile_data.get('name'):
            raise HTTPException(status_code=400, detail="Could not extract key information from CV.")

        file_bytes = await file.read()
        
        # This is the corrected storage path, relative to the bucket and user-specific.
        storage_path = f"{user_id}/{file.filename}"
        
        supabase.storage.from_("cv_uploads").upload(
            path=storage_path, 
            file=file_bytes, 
            file_options={"content-type": file.content_type, "upsert": "true"}
        )

        db_record = {
            "user_id": user_id,
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
        
        # Try inserting the record. If the database schema is missing optional
        # columns (common when different deployments have drifted), PostgREST
        # will return an error like PGRST204 or a message mentioning the column.
        # Detect that and retry the insert after removing the missing keys so
        # uploads succeed even on leaner schemas.
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

        # Audit resume upload
        try:
            log_audit(user_id, 'resume_uploaded', model=None, details={'file_name': file.filename, 'storage_path': storage_path})
        except Exception:
            pass

        return response.data[0]

    except Exception as e:
        print(f"AN ERROR OCCURRED DURING UPLOAD: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")


@router.get("/")
async def get_all_resumes(
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get('id')
    # Try to fetch resumes owned by the user's profile_id first, then fallback to user_id
    try:
        response = supabase.table('resumes').select("*").eq('profile_id', user_id).order('uploaded_at', desc=True).execute()
        if getattr(response, 'error', None):
            raise Exception(response.error)

        # If no rows found, try the older user_id column for backwards compatibility
        if not response.data:
            response = supabase.table('resumes').select("*").eq('user_id', user_id).order('uploaded_at', desc=True).execute()
            if getattr(response, 'error', None):
                raise Exception(response.error)

        return response.data
    except Exception as e:
        print(f"[get_all_resumes] error fetching resumes for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

    # Ensure we only delete resumes owned by the current user. IDs are strings (UUIDs) in DB.
    deleted_ids = []

    # First attempt delete by profile_id
    try:
        resp1 = supabase.table('resumes').delete().in_('id', ids_to_delete).eq('profile_id', user_id).execute()
        if getattr(resp1, 'error', None):
            print(f"[delete_resumes] error deleting by profile_id: {resp1.error}")
        else:
            deleted_ids.extend([r.get('id') for r in (resp1.data or []) if r.get('id')])
    except Exception as e:
        print(f"[delete_resumes] exception deleting by profile_id: {e}")

    # Delete any remaining ids using user_id (legacy column)
    remaining = [i for i in ids_to_delete if i not in deleted_ids]
    if remaining:
        try:
            resp2 = supabase.table('resumes').delete().in_('id', remaining).eq('user_id', user_id).execute()
            if getattr(resp2, 'error', None):
                print(f"[delete_resumes] error deleting by user_id: {resp2.error}")
            else:
                deleted_ids.extend([r.get('id') for r in (resp2.data or []) if r.get('id')])
        except Exception as e:
            print(f"[delete_resumes] exception deleting by user_id: {e}")

    return {"deleted_ids": deleted_ids}