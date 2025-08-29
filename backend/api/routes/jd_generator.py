from fastapi import APIRouter, HTTPException, Request, Depends
from api.models import JobDescriptionRequest
from services.jd_service import jd_service
from services.utils.audit_logger import log_event
from supabase import create_client
from config.settings import settings
from .resume_analyzer import get_current_user

# This prefix is the reason the URL changed to /jd/generate
router = APIRouter(prefix="/jd", tags=["Job Description"])

@router.post("/generate")
async def generate_job_description(request: JobDescriptionRequest, http: Request, current_user: dict = Depends(get_current_user)):
    try:
        generated_jd = jd_service.generate_jd(request)
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            log_event(supabase, action_type='jd_generate', user_id=current_user.get('id'), metadata={'job_title': request.job_title}, request=http)
        except Exception:
            pass
        return {"job_description": generated_jd}
    except Exception as e:
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            log_event(supabase, action_type='jd_generate', status='FAIL', user_id=current_user.get('id'), metadata={'error': str(e)}, request=http)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))