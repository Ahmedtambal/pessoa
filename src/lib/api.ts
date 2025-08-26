const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

export const API_ROUTES = {
  ADMIN_USERS: `${BASE_URL}/admin/users`,
  ADMIN_INVITE: `${BASE_URL}/admin/invite`,
  ADMIN_DELETE_ORG: `${BASE_URL}/admin/organization/delete`,
  ADMIN_UPDATE_USER: (userId: string) => `${BASE_URL}/admin/users/${userId}`,
  ADMIN_DELETE_USER: (userId: string) => `${BASE_URL}/admin/users/${userId}`,
  
  RESUME_UPLOAD: `${BASE_URL}/resumes/upload`,
  RESUME_COMPARE: `${BASE_URL}/resumes/compare`,
  RESUMES: `${BASE_URL}/resumes/`,

  GENERATE_JD: `${BASE_URL}/jd/generate`,
};