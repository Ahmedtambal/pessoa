from pydantic import BaseModel

class JobDescriptionRequest(BaseModel):
    job_title: str
    job_type: str
    location: str
    responsibilities: str
    requirements: str
    skills: str

class ResumeAnalysisRequest(BaseModel):
    job_description: str
    resume_text: str