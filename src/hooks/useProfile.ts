import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  organization_name: string;
  role: 'ADMIN' | 'MEMBER';
}

export const useProfile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Wrap fetchProfile in useCallback so it's a stable function
  const fetchProfile = useCallback(async () => {
    // Note: We don't set loading to true here on re-fetches to avoid screen flickers
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      setUser(session.user);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(profileData);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile(); // Initial fetch on component mount

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
            fetchProfile(); // Re-fetch when user logs in or token refreshes
        } else {
            // Clear data on logout
            setUser(null);
            setProfile(null);
            setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // THIS IS THE FIX: We now return the fetchProfile function as refreshProfile
  return { user, profile, loading, isAdmin: profile?.role === 'ADMIN', refreshProfile: fetchProfile };
};