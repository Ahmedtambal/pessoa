import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight } from 'lucide-react';
import { API_ROUTES } from '../lib/api';
import authFetch from '../lib/authFetch';

const InviteSignUpPage: React.FC = () => {
  const [formData, setFormData] = useState({ fullName: '', password: '', confirmPassword: '' });
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start in loading state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();
  const isDebug = (typeof window !== 'undefined' && (import.meta.env.DEV || new URL(window.location.href).searchParams.get('debug') === '1'));
  const debugLog = (...args: any[]) => { if (isDebug) console.log('[invite-signup]', ...args); };

  // --- THIS IS THE FIX ---
  // We now use a more direct and reliable method to get the invited user's data.
  useEffect(() => {
    const processInvite = async () => {
      debugLog('processInvite: starting');
      // Ensure no other session is present (e.g. an admin logged in on the same browser)
      // so that the invite token in the URL is processed for the invited user.
      try {
        await supabase.auth.signOut();
        debugLog('signed out any existing session');
      } catch (e) {
        console.warn('Failed to sign out before processing invite:', e);
      }

      // Parse invite params and tokens from URL
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash?.replace(/^#/, '') || '';
        const hashParams = new URLSearchParams(hash);
        const queryParams = url.searchParams;
        const typeParam = (queryParams.get('type') || '').toLowerCase();
        const tokenHash = queryParams.get('token_hash') || queryParams.get('token');
        const token = queryParams.get('token') || undefined;
        const code = queryParams.get('code') || undefined;
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        debugLog('parsed URL params', { typeParam, hasTokenHash: !!tokenHash, hasToken: !!token, hasCode: !!code, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

        // OAuth-style flow fallback (rare): exchange code for session
        if (code) {
          try {
            const { data: xData, error: xErr } = await supabase.auth.exchangeCodeForSession(code);
            debugLog('exchangeCodeForSession', { xData, xErr });
          } catch (xEx) {
            console.warn('exchangeCodeForSession exception:', xEx);
          }
        }

        // If Supabase redirected with token_hash (common for invite links), verify it to create a session
        if (!accessToken && tokenHash && (typeParam === 'invite' || typeParam === 'signup')) {
          try {
            const { data: vData, error: vErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' as any });
            debugLog('verifyOtp result', { vData, vErr });
            if (vErr) console.warn('verifyOtp (invite) failed:', vErr);
            if (vData?.session) {
              await supabase.auth.setSession({ access_token: vData.session.access_token, refresh_token: vData.session.refresh_token });
              const { data: sData } = await supabase.auth.getSession();
              debugLog('setSession (verifyOtp) -> session', sData);
            }
          } catch (vEx) {
            console.warn('verifyOtp exception:', vEx);
          }
        }

        // Fallback: some providers return raw token instead of token_hash
        if (!accessToken) {
          if (token && (typeParam === 'invite' || typeParam === 'signup')) {
            try {
              const { data: v2Data, error: v2Err } = await (supabase.auth as any).verifyOtp({ token, type: 'invite' });
              debugLog('verifyOtp (token) result', { v2Data, v2Err });
              if (!v2Err && v2Data?.session) {
                await supabase.auth.setSession({ access_token: v2Data.session.access_token, refresh_token: v2Data.session.refresh_token });
              }
            } catch (v2Ex) {
              console.warn('verifyOtp (token) exception:', v2Ex);
            }
          }
        }

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          const { data: sData } = await supabase.auth.getSession();
          debugLog('setSession (tokens-in-url) -> session', sData);
          // Clean tokens from URL for safety
          window.history.replaceState({}, document.title, url.origin + url.pathname);
        }
      } catch (parseErr) {
        console.warn('Could not parse/set invite tokens from URL:', parseErr);
      }

      // Now fetch the invited user
      const { data, error } = await supabase.auth.getUser();
      debugLog('getUser after session setup', { data, error });
      
      if (error || !data?.user) {
        // If there's an error or no user, the token is invalid or expired.
        setError("Invalid or expired invitation link. Please request a new one.");
        setIsLoading(false);
        return;
      }
      
  // If successful, we have the user's email and possibly user metadata (from the invite).
  setEmail(data.user.email || '');
  const invitedName = data.user.user_metadata?.full_name || '';
  setFormData(prev => ({ ...prev, fullName: invitedName }));
      setIsLoading(false); // Stop loading and enable the form
    };

    processInvite();
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Update the invited user with their new password and full name.
    const { data, error } = await supabase.auth.updateUser({
      password: formData.password,
      data: { full_name: formData.fullName.trim() }
    });
    debugLog('updateUser result', { data, error });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else if (data.user) {
      // After the user is created/updated, also persist their profile row (full name + invited org) in the DB.
      try {
        // Fetch the latest user object to read any metadata that was attached to the invite (invited_by, organization_name)
        const { data: fresh, error: freshError } = await supabase.auth.getUser();
        debugLog('fresh user fetch after updateUser', { fresh, freshError });
        if (freshError) {
          console.warn('Could not fetch user metadata after signup:', freshError);
        }

        const userId = fresh?.user?.id || data.user.id;
  const invitedOrg = fresh?.user?.user_metadata?.organization_name || null;
  const metadataName = fresh?.user?.user_metadata?.full_name || null;

  // Determine a non-empty full name to save: prefer form input, then metadata.
  const nameToSave = formData.fullName.trim() || metadataName || null;

  // Upsert into profiles table: id == auth user id
  // IMPORTANT: only set organization_name from invite metadata (invitedOrg). Do NOT use any other source
  // to assign organizations during invite acceptance — this prevents users being added to the wrong org.
  const profilePayload: any = { id: userId };
  if (nameToSave) profilePayload.full_name = nameToSave;
  if (invitedOrg) profilePayload.organization_name = invitedOrg;

        // Call backend endpoint that uses the service-role client to upsert the profile.
        try {
          const resp = await authFetch(API_ROUTES.ADMIN_PROFILE_UPSERT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: profilePayload.full_name || null, organization_name: profilePayload.organization_name || null })
          });
          const json = await resp.json();
          if (!resp.ok) console.warn('Profile upsert endpoint returned error:', json);
          else debugLog('Profile upserted via backend', json);
        } catch (e) {
          console.warn('Failed to call backend profile upsert endpoint:', e);
        }
      } catch (e) {
        console.warn('Failed to upsert profile after invite signup:', e);
      }

  setSuccess('Account created! You will be redirected to the login page to sign in.');
  // Ensure any session created during invite processing is cleared for security
  await supabase.auth.signOut();
  setTimeout(() => navigate('/login'), 4000);
    }
  };

  return (
    <div className="app-background min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Account</h1>
          <p className="text-white/70">You've been invited to join Pessoa.</p>
        </div>

        {error && <div className="bg-red-500/20 text-red-300 text-center p-3 rounded-lg mb-6">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-300 text-center p-3 rounded-lg mb-6">{success}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type="email" value={isLoading ? "Loading from invite..." : email} disabled className="glass-input w-full pl-12 bg-white/5 cursor-not-allowed" />
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type="text" name="fullName" placeholder="Your Full Name" value={formData.fullName} onChange={handleInputChange} className="glass-input w-full pl-12" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Create a Password" value={formData.password} onChange={handleInputChange} className="glass-input w-full pl-12 pr-12" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleInputChange} className="glass-input w-full pl-12" required />
            </div>
          </div>
          <button type="submit" disabled={isLoading || !email} className="primary-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <> Create Account <ArrowRight className="w-4 h-4" /> </>}
          </button>
        </form>
      </div>
    </div>
  );
};
export default InviteSignUpPage;