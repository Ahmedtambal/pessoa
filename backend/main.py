from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from api.routes import jd_generator, resume_analyzer, admin # <-- IMPORT NEW ROUTER

app = FastAPI(title="Pessoa AI Backend")

# Configure CORS origins from the FRONTEND_URL env var (useful for Render deploys)
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [frontend_url]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include API Routers ---
app.include_router(jd_generator.router)
app.include_router(resume_analyzer.router)
app.include_router(admin.router) # <-- ADD THE ADMIN ROUTER

# --- Root Endpoint for Health Check ---
@app.get("/")
def read_root():
    return {"status": "Pessoa AI Backend is running"}