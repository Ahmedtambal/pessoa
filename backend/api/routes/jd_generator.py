from fastapi import APIRouter, HTTPException
from api.models import JobDescriptionRequest
from services.jd_service import jd_service

# This prefix is the reason the URL changed to /jd/generate
router = APIRouter(prefix="/jd", tags=["Job Description"])

@router.post("/generate")
async def generate_job_description(request: JobDescriptionRequest):
    try:
        generated_jd = jd_service.generate_jd(request)
        return {"job_description": generated_jd}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))