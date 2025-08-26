import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User, Building, ArrowRight } from 'lucide-react';
// ...existing code...

const SignUpPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    // Call backend /register endpoint which will create the auth user via
    // the service role, upsert profile and organization atomically.
    try {
      const resp = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          organization_name: formData.organizationName || null,
        }),
      });

      setIsLoading(false);

      if (!resp.ok) {
        const err = await resp.json();
        setError(err.detail || JSON.stringify(err));
        return;
      }

      setSuccess('Success! Please check your email to confirm your account. For security, please sign in after confirming via email.');
    } catch (e: any) {
      setIsLoading(false);
      setError(e.message || 'Registration failed');
    }
  };

  return (
    <div className="app-background min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-white/70">Join Pessoa and transform your HR processes</p>
        </div>

        {error && <div className="bg-red-500/20 text-red-300 text-center p-3 rounded-lg mb-6">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-300 text-center p-3 rounded-lg mb-6">{success}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                <input type="text" name="firstName" placeholder="First name" value={formData.firstName} onChange={handleInputChange} className="glass-input w-full pl-12" required />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                <input type="text" name="lastName" placeholder="Last name" value={formData.lastName} onChange={handleInputChange} className="glass-input w-full pl-12" required />
              </div>
            </div>

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type="email" name="email" placeholder="Email address" value={formData.email} onChange={handleInputChange} className="glass-input w-full pl-12" required />
            </div>

            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type="text" name="organizationName" placeholder="Organization name" value={formData.organizationName} onChange={handleInputChange} className="glass-input w-full pl-12" required />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Password" value={formData.password} onChange={handleInputChange} className="glass-input w-full pl-12 pr-12" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
              <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" placeholder="Confirm password" value={formData.confirmPassword} onChange={handleInputChange} className="glass-input w-full pl-12 pr-12" required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors">{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
          </div>

          <div className="flex items-start">
            <input type="checkbox" id="terms" className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50 focus:ring-2 mt-1" required />
            <label htmlFor="terms" className="ml-2 text-sm text-white/70"> I agree to the <a href="/terms" className="text-primary hover:text-primary-400 transition-colors">Terms of Service</a> and <a href="/privacy" className="text-primary hover:text-primary-400 transition-colors">Privacy Policy</a></label>
          </div>

          <button type="submit" disabled={isLoading} className="primary-button w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <> Create Account <ArrowRight className="w-4 h-4" /> </>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-white/70"> Already have an account?{' '} <a href="/login" className="text-primary hover:text-primary-400 transition-colors font-medium"> Sign in </a></p>
        </div>
      </div>
    </div>
  );
};
export default SignUpPage;