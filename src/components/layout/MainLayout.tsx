import { useState } from 'react';
import Sidebar from './Sidebar';
import ProfilePage from '../../pages/ProfilePage';
import { useProfile } from '../../hooks/useProfile';
import { AnimatePresence } from 'framer-motion';

const FullscreenLoader = () => (
    <div className="app-background min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-primary rounded-full animate-spin" />
    </div>
);

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, profile, loading, refreshProfile } = useProfile();

  if (loading) {
    return <FullscreenLoader />;
  }
  
  return (
    <div className="app-background min-h-screen flex">
      <Sidebar 
        onProfileClick={() => setIsProfileOpen(true)} // This passes the function to open the modal
      />
      <main className="flex-1 p-8 transition-all duration-300 ml-64">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <AnimatePresence>
        {isProfileOpen && user && (
          <ProfilePage
            user={user}
            profile={profile}
            onClose={() => setIsProfileOpen(false)}
            onProfileUpdate={refreshProfile}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainLayout;