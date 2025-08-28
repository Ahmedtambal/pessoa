import React from 'react';
import MainLayout from '../components/layout/MainLayout';
import { ArrowLeft, Shield, Eye, Lock, Users, Mail, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
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
            <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-white/70">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-8 text-white/80">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Lock className="w-6 h-6 text-primary" />
                Introduction
              </h2>
              <p className="leading-relaxed">
                At Pessoa AI ("we", "us", or "our"), we are committed to protecting your privacy and ensuring the security of your personal data.
                This Privacy Policy explains how we collect, use, and safeguard your information when you use our AI-powered CV analysis and job description generation platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary" />
                Information We Collect
              </h2>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white">Personal Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Account Information:</strong> Email address, password, full name, and organization name</li>
                  <li><strong>CV Content:</strong> Resume files, extracted personal information (name, contact details, work experience, skills, education)</li>
                  <li><strong>Job Descriptions:</strong> Job requirements and descriptions you provide for analysis</li>
                </ul>

                <h3 className="text-xl font-semibold text-white">Technical Information</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>IP address and browser information</li>
                  <li>Usage patterns and feature interactions</li>
                  <li>Device and operating system information</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Service Provision:</strong> To provide CV analysis and job description generation services</li>
                <li><strong>AI Processing:</strong> To analyze resumes and match them with job requirements using artificial intelligence</li>
                <li><strong>Account Management:</strong> To create and manage your user account</li>
                <li><strong>Communication:</strong> To send service-related notifications and updates</li>
                <li><strong>Security:</strong> To protect against fraud and unauthorized access</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Data Processing and AI
              </h2>
              <div className="space-y-4">
                <p>
                  <strong>AI-Powered Analysis:</strong> Your CV data is processed by our AI systems to extract relevant information and match candidates with job requirements.
                  This processing helps identify key strengths, potential gaps, and overall suitability for specific roles.
                </p>
                <p>
                  <strong>Data Minimization:</strong> We only process data necessary for providing our services. We do not use your data for unrelated purposes or share it with third parties for marketing.
                </p>
                <p>
                  <strong>Purpose Limitation:</strong> Data collected for CV analysis will not be used to train global AI models without your explicit consent.
                </p>
                <p>
                  <strong>Explainable AI:</strong> We provide explanations for AI decisions through our analysis results, showing key strengths and potential gaps identified in candidate profiles.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Data Sharing and Third Parties</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Supabase:</strong> We use Supabase for database storage and user authentication</li>
                <li><strong>OpenAI:</strong> We use OpenAI's API for AI-powered text analysis and processing</li>
                <li><strong>No Marketing:</strong> We do not share your data with third parties for marketing purposes</li>
                <li><strong>Legal Requirements:</strong> We may share data when required by law or to protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Your Rights Under UK GDPR</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Access Rights</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Request access to your personal data</li>
                    <li>Receive a copy of your data</li>
                    <li>Know how your data is processed</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Control Rights</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Rectify inaccurate data</li>
                    <li>Erase your data ("right to be forgotten")</li>
                    <li>Restrict processing of your data</li>
                    <li>Data portability</li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-sm">
                <strong>Contact:</strong> To exercise these rights, please email us at privacy@pessoa.ai
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Automated Decision-Making</h2>
              <p className="leading-relaxed">
                Our AI system makes automated decisions about CV-job matching. You have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>Be informed about automated decision-making</li>
                <li>Request human intervention in the decision-making process</li>
                <li>Express your point of view about automated decisions</li>
                <li>Contest automated decisions that affect you significantly</li>
              </ul>
              <p className="mt-4">
                <strong>Manual Review:</strong> You can request a manual review of any AI analysis by contacting our support team.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
              <p className="leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal data:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Access controls and authentication requirements</li>
                <li>Regular security audits and updates</li>
                <li>File upload validation and size limits</li>
                <li>Rate limiting to prevent abuse</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Data Retention</h2>
              <p className="leading-relaxed">
                We retain your data only as long as necessary for the purposes outlined in this policy:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>CV Data:</strong> Retained until you delete it or close your account</li>
                <li><strong>Analysis Results:</strong> Retained with your CV data</li>
                <li><strong>Legal Obligations:</strong> Some data may be retained longer if required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Mail className="w-6 h-6 text-primary" />
                Contact Us
              </h2>
              <div className="bg-white/5 p-4 rounded-lg">
                <p className="mb-2"><strong>Data Protection Officer:</strong></p>
                <p>Email: privacy@pessoa.ai</p>
                <p>Address: [Company Address]</p>
                <p className="mt-4 text-sm">
                  We aim to respond to privacy-related inquiries within 30 days.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>Emailing you about the changes</li>
                <li>Posting a notice on our platform</li>
                <li>Updating the "Last updated" date at the top of this policy</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PrivacyPolicyPage;
