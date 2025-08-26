import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';
import { X, User, Lock, AlertTriangle } from 'lucide-react';
import { API_ROUTES } from '../lib/api';
import authFetch from '../lib/authFetch';
import type { Profile } from '../hooks/useProfile';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// --- PROPS INTERFACES ---
interface ProfilePageProps {
  user: SupabaseUser;
  profile: Profile;
  onClose: () => void;
  onProfileUpdate: () => void;
}
interface ProfileSettingsProps {
    user: SupabaseUser;
    profile: Profile;
    onUpdate: () => void;
}
interface DangerZoneProps {
    onClose: () => void;
}

// --- Main Modal Component ---
const ProfilePage = ({ user, profile, onClose, onProfileUpdate }: ProfilePageProps) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'danger'>('profile');

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'security', label: 'Password & Security', icon: Lock },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        exit={{ scale: 0.95, y: 20 }} 
        transition={{ duration: 0.2 }}
        className="glass-card w-full max-w-4xl h-auto max-h-[90vh] md:h-auto md:max-h-[700px] relative flex flex-col md:flex-row overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-4 right-4 glass-button p-2 z-10"><X className="w-4 h-4" /></button>
        
        {/* --- Left Column: Navigation Tabs --- */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 p-6 flex-shrink-0">
          <h2 className="text-xl font-bold text-white mb-8">Account Settings</h2>
          <div className="space-y-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group ${
                  activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                <tab.icon className="w-5 h-5"/>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- Right Column: Content --- */}
        <div className="w-full md:w-2/3 p-8 overflow-y-auto">
          {activeTab === 'profile' && <ProfileSettings profile={profile} user={user} onUpdate={onProfileUpdate} />}
          {activeTab === 'security' && <PasswordSettings />}
          {activeTab === 'danger' && <DangerZone onClose={onClose} />}
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Sub-component for Profile Details ---
const ProfileSettings = ({ profile, user, onUpdate }: ProfileSettingsProps) => {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [orgName, setOrgName] = useState(profile.organization_name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleUpdate = async () => {
    setLoading(true); setMessage(null);
    const { error } = await supabase.from('profiles').update({ full_name: fullName, organization_name: orgName }).eq('id', user.id);
    if (!error) {
      setMessage({ type: 'success', text: 'Profile updated successfully!'});
      onUpdate();
    } else {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-white">Public Profile</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} type="text" className="glass-input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">Organization Name</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} type="text" className="glass-input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">Email Address</label>
          <input value={user.email} type="email" disabled className="glass-input w-full bg-white/5 cursor-not-allowed" />
        </div>
        <button onClick={handleUpdate} disabled={loading} className="primary-button w-40 flex justify-center">{loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"/> : 'Save Changes'}</button>
        {message && <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
      </div>
    </div>
  );
};

// --- Sub-component for Password Settings ---
const PasswordSettings = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleUpdate = async () => {
    if (password !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match.'}); return; }
    if (password.length < 6) { setMessage({ type: 'error', text: 'Password must be at least 6 characters.'}); return; }
    setLoading(true); setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setMessage({ type: 'success', text: 'Password updated successfully!'});
      setPassword(''); setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-white">Change Password</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">New Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="glass-input w-full" />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">Confirm New Password</label>
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="glass-input w-full" />
        </div>
        <button onClick={handleUpdate} disabled={loading} className="primary-button w-48 flex justify-center">{loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"/> : 'Update Password'}</button>
        {message && <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
      </div>
    </div>
  );
};

// --- Sub-component for Danger Zone (NOW FULLY FUNCTIONAL) ---
const DangerZone = ({ onClose }: DangerZoneProps) => {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleDelete = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Authentication error. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await authFetch(API_ROUTES.ADMIN_PROFILE_DELETE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || "Failed to delete account.");
        }
        
        alert(result.message || "Account deletion successful. You will now be logged out.");
        await supabase.auth.signOut();
        window.location.href = '/login';

      } catch (error: any) {
        alert(`An error occurred: ${error.message}`);
      } finally {
        setLoading(false);
        onClose();
      }
  };

  return (
      <div className="space-y-6">
          <h3 className="text-2xl font-bold text-red-400">Danger Zone</h3>
          <div className="border-t border-red-500/30 pt-6">
              <h4 className="text-xl font-semibold text-white">Delete My Account</h4>
              <p className="text-white/60 text-sm mt-2 mb-4">This action is irreversible. If you are the last admin, this will also delete the entire organization and all its data.</p>
              <div>
                  <label className="text-sm font-medium text-white/70 block mb-2">To confirm, type "delete" below:</label>
                  <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} type="text" className="glass-input w-full border-red-500/30" />
              </div>
              <button onClick={handleDelete} disabled={deleteConfirm !== 'delete' || loading} className="mt-4 primary-button bg-red-600 hover:bg-red-500 w-52 flex justify-center disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"/> : 'Delete My Account'}
              </button>
          </div>
      </div>
  );
};

export default ProfilePage;