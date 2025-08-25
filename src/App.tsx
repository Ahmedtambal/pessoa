import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import GenerateJDPage from './pages/GenerateJDPage';
import CompareCVsPage from './pages/CompareCVsPage';
import ResumeBankPage from './pages/ResumeBankPage';
import SettingsPage from './pages/SettingsPage';
import InviteSignUpPage from './pages/InviteSignUpPage';

// LandingPage Component
const LandingPage: React.FC = () => (
    <div className="app-background min-h-screen flex items-center justify-center">
      <div className="glass-card max-w-md w-full mx-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">Pessoa</h1>
          <p className="text-white/70 text-lg mb-6">Intelligent HR Platform powered by AI</p>
          <div className="flex flex-col gap-4">
            <a href="/dashboard" className="primary-button text-center">Get Started</a>
            <a href="/login" className="secondary-button text-center">Sign In</a>
          </div>
        </div>
      </div>
    </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/invite-signup" element={<InviteSignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/generate-jd" element={<GenerateJDPage />} />
          <Route path="/compare-cvs" element={<CompareCVsPage />} />
          <Route path="/resumes" element={<ResumeBankPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;