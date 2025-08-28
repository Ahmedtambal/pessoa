import React from 'react';
import MainLayout from '../components/layout/MainLayout';
import { ArrowLeft, FileText, Shield, AlertTriangle, Users, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <FileText className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
            <p className="text-white/70">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-8 text-white/80">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                Agreement to Terms
              </h2>
              <p className="leading-relaxed">
                By accessing and using Pessoa AI ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
                These Terms of Service apply to all users of the Service, including without limitation users who are browsers, vendors, customers, merchants, or contributors of content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Description of Service</h2>
              <p className="leading-relaxed">
                Pessoa AI is an AI-powered platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>CV (resume) analysis and comparison with job descriptions</li>
                <li>Automated job description generation</li>
                <li>Resume bank management and storage</li>
                <li>AI-powered candidate evaluation and ranking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                User Accounts
              </h2>
              <div className="space-y-4">
                <p><strong>Account Creation:</strong> To use our Service, you must create an account with accurate and complete information.</p>
                <p><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
                <p><strong>Account Termination:</strong> We reserve the right to terminate accounts that violate these terms or engage in prohibited activities.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Acceptable Use</h2>
              <div className="space-y-4">
                <p>You agree not to use the Service to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Upload illegal, harmful, or inappropriate content</li>
                  <li>Violate intellectual property rights of others</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Attempt to gain unauthorized access to the Service</li>
                  <li>Use the Service for discriminatory purposes</li>
                  <li>Upload malicious files or viruses</li>
                  <li>Circumvent security measures or rate limits</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Content Ownership and Rights</h2>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white">Your Content</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>You retain ownership of the CVs and job descriptions you upload</li>
                  <li>You grant us a license to process and analyze your content for providing the Service</li>
                  <li>You are responsible for ensuring you have the right to upload and process the content</li>
                </ul>

                <h3 className="text-xl font-semibold text-white">Our Content</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>The Service and its original content are protected by intellectual property laws</li>
                  <li>You may not reproduce, distribute, or create derivative works without permission</li>
                  <li>Our trademarks and branding remain our exclusive property</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">AI and Automated Decision-Making</h2>
              <div className="space-y-4">
                <p>
                  <strong>AI Limitations:</strong> Our AI system provides analysis and recommendations but should not be considered as the sole decision-making tool for employment decisions.
                </p>
                <p>
                  <strong>Human Judgment:</strong> Users should apply their own judgment and not rely solely on AI recommendations when making employment or hiring decisions.
                </p>
                <p>
                  <strong>Manual Review:</strong> You have the right to request human review of any AI-generated analysis or decision.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-primary" />
                Disclaimers and Limitations
              </h2>
              <div className="space-y-4">
                <p>
                  <strong>Service "As Is":</strong> The Service is provided on an "as is" and "as available" basis. We make no warranties, expressed or implied.
                </p>
                <p>
                  <strong>AI Accuracy:</strong> AI analysis results are not guaranteed to be 100% accurate. Results should be used as guidance, not definitive assessments.
                </p>
                <p>
                  <strong>Third-Party Services:</strong> We integrate with third-party services (Supabase, OpenAI). We are not responsible for their performance or availability.
                </p>
                <p>
                  <strong>Limitation of Liability:</strong> Our total liability shall not exceed the amount you paid for the Service in the 12 months preceding the claim.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Privacy and Data Protection</h2>
              <p className="leading-relaxed">
                Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy,
                which is incorporated into these Terms by reference. By using our Service, you consent to the collection and use of
                your information as outlined in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Termination</h2>
              <div className="space-y-4">
                <p><strong>By You:</strong> You may terminate your account at any time through the Service settings.</p>
                <p><strong>By Us:</strong> We may terminate or suspend your account immediately for violations of these terms.</p>
                <p><strong>Effect of Termination:</strong> Upon termination, your right to use the Service ceases immediately.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Scale className="w-6 h-6 text-primary" />
                Governing Law
              </h2>
              <p className="leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of England and Wales.
                Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Changes to Terms</h2>
              <p className="leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of material changes via email or through the Service.
                Your continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Contact Information</h2>
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="mb-2"><strong>For questions about these Terms:</strong></p>
                <p>Email: legal@pessoa.ai</p>
                <p>Address: [Company Address]</p>
              </div>
            </section>

            <section className="border-t border-white/20 pt-8">
              <p className="text-center text-white/60">
                By using Pessoa AI, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TermsOfServicePage;
