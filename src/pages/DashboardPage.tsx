import React from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { Edit3, Users } from 'lucide-react';
import { useProfile } from '../hooks/useProfile'; // <-- 1. IMPORT THE HOOK

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading } = useProfile(); // <-- 2. USE THE HOOK to get the profile

  // This function formats the user's name, providing a fallback.
  const getUserFirstName = () => {
    if (loading) return '...';
    if (!profile || !profile.full_name) return 'User';
    // Split the full name and return the first part.
    return profile.full_name.split(' ')[0];
  };
  
  // This uses the browser's Intl API to get the user's local date and time
  const fullDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <MainLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              {/* --- THIS IS THE FIX --- */}
              <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {getUserFirstName()}!</h1>
              <p className="text-white/70">Here's what's happening with your HR processes today.</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-sm">Today</p>
              {/* --- THIS IS THE FIX --- */}
              <p className="text-white font-semibold">{fullDate}</p>
              <p className="text-white/80 text-sm">{currentTime}</p>
            </div>
          </div>
        </div>

        {/* Navigation Boxes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
          {/* Generate Job Description Box */}
          <div onClick={() => navigate('/generate-jd')} className="glass-card p-8 text-center cursor-pointer group hover:border-primary/50 transition-all duration-300">
            <Edit3 className="w-16 h-16 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-bold text-white mb-2">Generate a Job Description</h2>
            <p className="text-white/60">Use AI to create compelling job descriptions based on your requirements.</p>
          </div>

          {/* Compare CVs Box */}
          <div onClick={() => navigate('/compare-cvs')} className="glass-card p-8 text-center cursor-pointer group hover:border-primary/50 transition-all duration-300">
            <Users className="w-16 h-16 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-bold text-white mb-2">Compare CVs</h2>
            <p className="text-white/60">Upload a job description and resumes to see the best matches.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardPage;