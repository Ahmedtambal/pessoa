Render + GitHub + Supabase deployment notes

1) .env files
- Copy the examples and fill your real secrets:
  - cp .env.example .env
  - cp backend/.env.example backend/.env

2) Frontend (Static Site on Render)
- Build command: npm ci && npm run build
- Publish directory: dist
- Env vars (set in Render dashboard under Static Site -> Environment):
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY

3) Backend (Web Service on Render)
- Root directory: backend
- Build command: pip install -r requirements.txt
- Start command: uvicorn main:app --host 0.0.0.0 --port $PORT
- Env vars (add as "Secrets"):
  - OPENAI_API_KEY
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - FRONTEND_URL (set to your frontend Render URL, e.g. https://your-site.onrender.com)

4) Supabase
- In Supabase > Settings > API: copy Project URL and anon/service_role keys.
- In Supabase > Authentication > Settings > URL Configuration:
  - Set Site URL to your frontend Render URL
  - Add Redirect URLs (invite callbacks / signin callbacks)

5) CORS
- backend/main.py reads FRONTEND_URL for CORS; set this env var in Render backend service.

6) Security
- Never expose SUPABASE_SERVICE_ROLE_KEY on the frontend.
- Use Render Secrets for backend env.

7) Post-deploy checks
- Visit frontend URL
- Call backend root URL: https://<backend>.onrender.com/
- Test invite -> accept -> signup flow and check backend logs for /admin/profile/upsert

If you want, I can commit these small example env files and CORS change (already applied). I can also patch README with a short Render checklist or create Render config files if you prefer (e.g. render.yaml).
