// Prefer explicit VITE_BACKEND_URL set at build/deploy time. When missing (common
// if env vars weren't set on the hosting provider), fall back at runtime to the
// same origin so the frontend doesn't call localhost on the server.
const runtimeFallback = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://127.0.0.1:8000';
const BASE_URL = import.meta.env.VITE_BACKEND_URL || runtimeFallback;

// Debug: print the resolved backend URL at runtime to help diagnose deployments
// where the frontend may still call localhost. Remove this log after debugging.
if (typeof window !== 'undefined' && window?.console) {
  // use warn so it's visible in most consoles
  // eslint-disable-next-line no-console
  console.warn('[pessoa] API BASE_URL ->', BASE_URL);
}

export const API_ROUTES = {
  ADMIN_USERS: `${BASE_URL}/admin/users`,
  ADMIN_INVITE: `${BASE_URL}/admin/invite`,
  ADMIN_DELETE_ORG: `${BASE_URL}/admin/organization/delete`,
  ADMIN_UPDATE_USER: (userId: string) => `${BASE_URL}/admin/users/${userId}`,
  ADMIN_DELETE_USER: (userId: string) => `${BASE_URL}/admin/users/${userId}`,
  // Profile admin endpoints (server-side service-role)
  ADMIN_PROFILE_UPSERT: `${BASE_URL}/admin/profile/upsert`,
  ADMIN_PROFILE_DELETE: `${BASE_URL}/admin/profile/delete`,
  
  RESUME_UPLOAD: `${BASE_URL}/resumes/upload`,
  RESUME_COMPARE: `${BASE_URL}/resumes/compare`,
  RESUMES: `${BASE_URL}/resumes/`,

  GENERATE_JD: `${BASE_URL}/jd/generate`,
  REGISTER: `${BASE_URL}/register`,
};