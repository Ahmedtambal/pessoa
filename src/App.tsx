import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import CookieConsentBanner, { CookiePreferences } from './components/common/CookieConsentBanner';

// Performance: Lazy load pages to reduce initial bundle size
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage'));
const GenerateJDPage = lazy(() => import('./pages/GenerateJDPage'));
const CompareCVsPage = lazy(() => import('./pages/CompareCVsPage'));
const ResumeBankPage = lazy(() => import('./pages/ResumeBankPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const InviteSignUpPage = lazy(() => import('./pages/InviteSignUpPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));

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
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    // Check if user has already made cookie choices
    const savedPreferences = localStorage.getItem('cookiePreferences');
    if (!savedPreferences) {
      // Show banner after a short delay to avoid being too intrusive
      const timer = setTimeout(() => {
        setShowCookieBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setCookiePreferences(JSON.parse(savedPreferences));
    }
  }, []);

  const handleCookieAccept = (preferences: CookiePreferences) => {
    setCookiePreferences(preferences);
    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    setShowCookieBanner(false);

    // Here you would typically initialize analytics, marketing pixels, etc.
    // based on the user's preferences
    if (preferences.analytics) {
      // Initialize analytics (e.g., Google Analytics)
      console.log('Analytics cookies accepted');
    }
    if (preferences.marketing) {
      // Initialize marketing pixels
      console.log('Marketing cookies accepted');
    }
    if (preferences.functional) {
      // Enable functional features
      console.log('Functional cookies accepted');
    }
  };

  const handleCookieReject = () => {
    const necessaryOnly: CookiePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setCookiePreferences(necessaryOnly);
    localStorage.setItem('cookiePreferences', JSON.stringify(necessaryOnly));
    setShowCookieBanner(false);
  };

  // Performance: Loading component for lazy-loaded pages
  const PageLoader = () => (
    <div className="app-background min-h-screen flex items-center justify-center">
      <div className="glass-card p-8 text-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white">Loading...</p>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/invite-signup" element={<InviteSignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/generate-jd" element={<GenerateJDPage />} />
            <Route path="/compare-cvs" element={<CompareCVsPage />} />
            <Route path="/resumes" element={<ResumeBankPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>

      {showCookieBanner && (
        <CookieConsentBanner
          onAccept={handleCookieAccept}
          onReject={handleCookieReject}
        />
      )}
    </BrowserRouter>
  );
}

export default App;