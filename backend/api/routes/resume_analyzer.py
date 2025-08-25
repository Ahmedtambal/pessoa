from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from supabase import create_client, Client
from pydantic import BaseModel
from config.settings import settings
from services.resume_service import resume_service

# --- Pydantic model for the delete request body ---
class DeleteRequest(BaseModel):
    ids: List[int]

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
        user_response = supabase.auth.get_user(jwt=token.credentials)
        user = user_response.user
        if not user:
             raise HTTPException(status_code=401, detail="User not found or token is invalid")
        return user.dict()
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
        
        response = supabase.table('resumes').insert(db_record).execute()
        
        if not response.data:
             raise HTTPException(status_code=500, detail="Failed to save resume metadata to the database.")

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
    # This now securely fetches ONLY the resumes belonging to the logged-in user.
    response = supabase.table('resumes').select("*").eq('user_id', user_id).order('uploaded_at', desc=True).execute()
    return response.data


@router.delete("/")
async def delete_resumes(
    request: DeleteRequest, 
    supabase: Client = Depends(get_supabase_client),
    current_user: dict = Depends(get_current_user)
):
    ids_to_delete = request.ids
    if not ids_to_delete:
        raise HTTPException(status_code=400, detail="No resume IDs provided.")
    
    user_id = current_user.get('id')
    # This securely deletes ONLY the resumes that both have the specified IDs AND belong to the logged-in user.
    response = supabase.table('resumes').delete().in_('id', ids_to_delete).eq('user_id', user_id).execute()
    return response.data