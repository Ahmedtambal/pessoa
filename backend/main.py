from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os

from api.routes import jd_generator, resume_analyzer, admin  # <-- IMPORT NEW ROUTER

app = FastAPI(title="Pessoa AI Backend")

# Read frontend origin from env (set this on Render / production)
FRONTEND_URL = os.getenv("FRONTEND_URL")

# Allow local dev origin plus the configured frontend origin when present.
# If FRONTEND_URL isn't set (e.g. local or older deploys), include the known
# Render frontend origin used in production so the app won't fail CORS silently.
origins = ["http://localhost:5173"]
if FRONTEND_URL:
    origins.append(FRONTEND_URL)
else:
    origins.append("https://pessoa-frontend.onrender.com")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware to enforce auth on sensitive admin routes and to add security headers
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Simple enforcement: admin routes must present an Authorization header.
        # The actual token validation is handled in your route logic using Supabase.
        # IMPORTANT: allow OPTIONS preflight requests through without Authorization
        # so CORS checks can succeed for browser requests.
        if request.url.path.startswith("/admin"):
            if request.method == "OPTIONS":
                # let preflight through
                return await call_next(request)
            if not request.headers.get("authorization"):
                return JSONResponse({"detail": "Missing authorization header"}, status_code=401)

        response = await call_next(request)

        # Add secure response headers
        response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer-when-downgrade")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=()")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")

        # Minimal CSP: restrict default sources to self, allow connecting to frontend if configured
        csp = "default-src 'self'"
        if FRONTEND_URL:
            csp = f"{csp}; connect-src 'self' {FRONTEND_URL}"
        else:
            csp = f"{csp}; connect-src 'self'"
        response.headers.setdefault("Content-Security-Policy", csp)

        return response


app.add_middleware(SecurityHeadersMiddleware)

# --- Include API Routers ---
app.include_router(jd_generator.router)
app.include_router(resume_analyzer.router)
app.include_router(admin.router) # <-- ADD THE ADMIN ROUTER

# --- Root Endpoint for Health Check ---
@app.get("/")
def read_root():
    return {"status": "Pessoa AI Backend is running"}