import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  // ADD THIS STATE
  const [error, setError] = useState<string | null>(null);

  // THIS FUNCTION IS UPDATED
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setIsLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setIsEmailSent(true);
    }
  };

  const handleBackToLogin = () => {
    window.location.href = '/login';
  };

  if (isEmailSent) {
    // Your success UI is unchanged
    return (
      <div className="app-background min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full animate-fade-in text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-white/70"> We've sent a password reset link to{' '} <span className="text-white font-medium">{email}</span> </p>
          </div>
          <div className="space-y-4">
            <p className="text-white/60 text-sm">Didn't receive the email? Check your spam folder or try again.</p>
            <button onClick={() => setIsEmailSent(false)} className="secondary-button w-full">Try Again</button>
            <button onClick={handleBackToLogin} className="glass-button w-full flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" />Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-white/70">Enter your email address and we'll send you a link to reset your password</p>
        </div>
        {/* ADD THIS BLOCK FOR ERRORS */}
        {error && <div className="bg-red-500/20 text-red-300 text-center p-3 rounded-lg mb-6">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input w-full pl-12" required />
          </div>
          <button type="submit" disabled={isLoading} className="primary-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <> Send Reset Link <ArrowRight className="w-4 h-4" /> </>}
          </button>
        </form>
        <div className="mt-8 text-center">
          <button onClick={handleBackToLogin} className="text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
            <ArrowLeft className="w-4 h-4" />Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
export default ForgotPasswordPage;