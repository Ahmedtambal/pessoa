import { supabase } from './supabaseClient';

export async function authFetch(input: RequestInfo, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const merged: RequestInit = { ...init, headers };
  return fetch(input, merged);
}

export default authFetch;
