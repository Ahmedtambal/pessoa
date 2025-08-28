import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Home, FileText, Settings, LogOut, ChevronLeft, ChevronRight, User, Building } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
}

// FIX: Correctly type the props
interface SidebarProps {
  onProfileClick: () => void;
}

const Sidebar = ({ onProfileClick }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState(window.location.pathname);
  const { profile, user, isAdmin, loading } = useProfile();

  const navigationItems: NavigationItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'resumes', label: 'Resume Bank', icon: FileText, path: '/resumes' },
  // Only reveal the settings link after we've finished loading the profile
  // and confirmed the user is an admin. This prevents the Settings item from
  // briefly appearing while the profile loads and then disappearing.
  ...(!loading && isAdmin ? [{ id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }] : []),
  ];

  const handleNavigation = (itemId: string, path: string) => {
    setActiveItem(itemId);
    window.location.href = path;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="glass-card h-full rounded-none rounded-r-2xl border-l-0 flex flex-col">
        {/* Header (unchanged) */}
        <div className="flex items-center justify-center p-4 border-b border-white/10 h-[88px]">
          <div className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-between w-full'}`}>
              {!isCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><Building className="w-5 h-5 text-white" /></div>
                  <div><h1 className="text-xl font-bold text-white">Pessoa</h1></div>
                </div>
              )}
              <button onClick={() => setIsCollapsed(!isCollapsed)} className="glass-button p-2 hover:bg-white/20">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-white" /> : <ChevronLeft className="w-4 h-4 text-white" />}
              </button>
          </div>
        </div>

        {/* Navigation (unchanged) */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem.startsWith(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id, item.path)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${isCollapsed ? 'justify-center' : ''} ${isActive ? 'bg-primary text-white shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                  {!isCollapsed && <span className="font-medium">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-white/10">
          {/* --- THIS IS THE FIX --- */}
          {/* The entire block is now a button that correctly uses the onProfileClick prop */}
          <button 
            onClick={onProfileClick} 
            disabled={loading} 
            className="w-full text-left"
            title={isCollapsed ? 'View Profile' : undefined}
          >
            {isCollapsed ? (
                <div className="flex justify-center py-2"><div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-white" /></div></div>
            ) : (
                <div className="glass-card p-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Better display logic: shows a fallback if name is missing */}
                      <p className="text-sm font-medium text-white truncate">
                        {loading ? 'Loading...' : (profile?.full_name || user?.email)}
                      </p>
                      <p className="text-xs text-white/60 truncate">
                        {loading ? '...' : (
                          profile ?
                            `${profile.organization_name || 'No Organization'} • ${profile.role}` :
                            'Profile not loaded'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
            )}
          </button>
          
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white/70 hover:text-white hover:bg-red-500/20 transition-all duration-200 group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-5 h-5 text-white/70 group-hover:text-red-400" />
            {!isCollapsed && <span className="font-medium group-hover:text-red-400">Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Sidebar;