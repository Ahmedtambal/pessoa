import React, { useState, useEffect, useCallback } from 'react';
import { API_ROUTES } from '../lib/api';
import MainLayout from '../components/layout/MainLayout';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabaseClient';
import authFetch from '../lib/authFetch';
import { Send, Trash2, Edit, Check, X } from 'lucide-react';
import CustomSelect from '../components/common/CustomSelect';
import type { Profile } from '../hooks/useProfile';

// --- Types ---
interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'ADMIN' | 'MEMBER';
}

// --- Main Settings Page Component ---
const SettingsPage: React.FC = () => {
  const { profile, isAdmin } = useProfile();
  const [activeTab, setActiveTab] = useState('users');

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="glass-card p-8 text-center"><h1 className="text-3xl font-bold text-red-400">Access Denied</h1><p className="text-white/70 mt-2">You do not have permission to view this page.</p></div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
        <div className="flex border-b border-white/10">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-3 font-medium ${activeTab === 'users' ? 'text-primary border-b-2 border-primary' : 'text-white/60'}`}>User Management</button>
          <button onClick={() => setActiveTab('invites')} className={`px-4 py-3 font-medium ${activeTab === 'invites' ? 'text-primary border-b-2 border-primary' : 'text-white/60'}`}>Invite Employees</button>
          <button onClick={() => setActiveTab('organization')} className={`px-4 py-3 font-medium ${activeTab === 'organization' ? 'text-primary border-b-2 border-primary' : 'text-white/60'}`}>Organization</button>
        </div>
        <div className="glass-card p-8">
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'invites' && <InviteEmployees />}
            {activeTab === 'organization' && <OrganizationSettings profile={profile} />}
        </div>
      </div>
    </MainLayout>
  );
};

// --- USER MANAGEMENT COMPONENT ---
const UserManagement = () => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [, setLoading] = useState(true);
    const { user: currentUser } = useProfile();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
            const response = await authFetch(API_ROUTES.ADMIN_USERS);
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) { console.error("API call failed:", error); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Manage Users</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="p-3 text-sm font-semibold text-white/80">User</th>
                            <th className="p-3 text-sm font-semibold text-white/80">Role</th>
                            <th className="p-3 text-sm font-semibold text-white/80 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <UserRow key={user.id} user={user} currentUserId={currentUser?.id} refreshUsers={fetchUsers} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- A single row in the user table ---
const UserRow: React.FC<{user: AppUser, currentUserId: string | undefined, refreshUsers: () => void}> = ({ user, currentUserId, refreshUsers }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MEMBER'>(user.role);
    const roleOptions = ['ADMIN', 'MEMBER'];
    const isSelf = user.id === currentUserId;

    const handleUpdateRole = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
    await authFetch(API_ROUTES.ADMIN_UPDATE_USER(user.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: selectedRole })
        });
        setIsEditing(false);
        refreshUsers();
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete the user ${user.email}? This action is permanent.`)) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
    await authFetch(API_ROUTES.ADMIN_DELETE_USER(user.id), { method: 'DELETE' });
        refreshUsers();
    };

    return (
        <tr className="border-b border-white/5">
            <td className="p-3">
                <p className="font-medium text-white">{user.full_name || 'Invited User'}</p>
                <p className="text-sm text-white/60">{user.email}</p>
            </td>
            <td className="p-3 w-48">
                {isEditing && !isSelf ? (
                    <CustomSelect options={roleOptions} value={selectedRole} onChange={(value) => setSelectedRole(value as 'ADMIN' | 'MEMBER')} />
                ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'ADMIN' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/70'}`}>{user.role}</span>
                )}
            </td>
            <td className="p-3 text-right">
                <div className="flex gap-2 justify-end">
                    {isSelf ? <span className="text-xs text-white/50">(This is you)</span> : isEditing ? (
                        <>
                            <button onClick={handleUpdateRole} className="glass-button p-2"><Check className="w-4 h-4 text-green-400" /></button>
                            <button onClick={() => { setIsEditing(false); setSelectedRole(user.role); }} className="glass-button p-2"><X className="w-4 h-4 text-red-400" /></button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="glass-button p-2"><Edit className="w-4 h-4" /></button>
                            <button onClick={handleDelete} className="glass-button p-2"><Trash2 className="w-4 h-4 text-red-400" /></button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
};

// --- INVITE EMPLOYEES COMPONENT ---
const InviteEmployees = () => {
    const [emails, setEmails] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleInvite = async () => {
        setLoading(true); setMessage(null);
        const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
        if (emailList.length === 0) { setMessage({ type: 'error', text: 'Please enter at least one valid email.'}); setLoading(false); return; }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
            const response = await authFetch(API_ROUTES.ADMIN_INVITE, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invites: emailList, role }),
            });
            if (!response.ok) {
                // Try to parse JSON error returned by the backend. If parsing fails, fall back to status text.
                let errorText = response.statusText || 'An unknown error occurred.';
                try {
                    const errorData = await response.json();
                    // If backend provided a detail object, stringify a useful summary.
                    if (errorData?.detail) {
                        if (typeof errorData.detail === 'string') errorText = errorData.detail;
                        else errorText = JSON.stringify(errorData.detail);
                    } else if (errorData?.message) {
                        errorText = errorData.message;
                    }
                } catch (e) {
                    // ignore JSON parse errors and keep statusText
                }
                throw new Error(errorText || 'An unknown error occurred.');
            }
            setMessage({ type: 'success', text: 'Invitations sent successfully!'}); setEmails('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to send invitations.' });
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Invite New Members</h2>
            <div className="space-y-4 max-w-lg">
                <div>
                    <label className="text-sm font-medium text-white/70 block mb-2">Email Addresses</label>
                    <textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="Enter one or more emails, separated by commas" className="glass-input w-full min-h-[100px]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-white/70 block mb-2">Assign Role</label>
                  <CustomSelect options={['MEMBER', 'ADMIN']} value={role} onChange={(value) => setRole(value as 'ADMIN' | 'MEMBER')} />
                </div>
                <button onClick={handleInvite} disabled={loading} className="primary-button w-48 flex justify-center"><Send className="w-4 h-4 mr-2" />{loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"/> : 'Send Invites'}</button>
                {message && <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message.text}</p>}
            </div>
        </div>
    );
};

// --- ORGANIZATION SETTINGS COMPONENT ---
const OrganizationSettings: React.FC<{profile: Profile | null}> = ({ profile }) => {
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const orgName = profile?.organization_name || '';

    const handleDelete = async () => {
        const normalizedInput = deleteConfirm.trim().toLowerCase();
        const normalizedOrg = orgName.trim().toLowerCase();
        if (normalizedInput !== normalizedOrg) {
            alert(`Please type "${orgName}" exactly to confirm.`);
            return;
        }
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        try {
            const response = await authFetch(API_ROUTES.ADMIN_DELETE_ORG, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organization_name: orgName }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete organization.');
            }
            alert("Organization deletion processing. You will be logged out.");
            await supabase.auth.signOut();
            window.location.href = '/login';
        } catch (error: any) {
            alert(`An error occurred: ${error.message}`);
        }
        setLoading(false);
    };

    const canDelete = !loading && deleteConfirm.trim().toLowerCase() === orgName.trim().toLowerCase();

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-red-400">Delete Organization</h2>
            <p className="text-white/70">This will permanently delete your organization, all its users, and all associated data. This action cannot be undone.</p>
            <div>
                            <label className="text-sm font-medium text-white/70 block mb-2">To confirm, please type your organization name: <span className="text-white font-semibold">{orgName}</span></label>
                            <input
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { handleDelete(); } }}
                                type="text"
                                className="glass-input w-full md:w-1/2 border-red-500/30"
                                placeholder={orgName}
                            />
            </div>
                            <button onClick={handleDelete} disabled={!canDelete} className="primary-button bg-red-600 hover:bg-red-500 w-60 flex justify-center disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"/> : 'Delete This Organization'}
                        </button>
        </div>
    );
};

export default SettingsPage;