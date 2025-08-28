import React, { useState, useMemo, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, X, MessageSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { API_ROUTES } from '../lib/api';

// Main CompareCVsPage component
const CompareCVsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Performance: Optimized file change handler with validation
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Performance: Validate files before adding to state
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const validExtensions = ['.pdf', '.doc', '.docx'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      return validTypes.includes(file.type) ||
             validExtensions.includes(fileExt) ||
             file.size <= 5 * 1024 * 1024; // 5MB limit
    });

    if (validFiles.length !== files.length) {
      setError('Some files were skipped due to invalid format or size. Only PDF, DOC, DOCX files under 5MB are allowed.');
    }

    setCvFiles(prev => [...prev, ...validFiles]);
    // Reset input value to allow re-selection of same file
    e.target.value = '';
  }, []);
  
  // Performance: Optimized remove function with useCallback
  const removeFile = useCallback((fileName: string) => {
    setCvFiles(prev => prev.filter(file => file.name !== fileName));
  }, []);

  // Performance: Memoized validation checks
  const isFormValid = useMemo(() => {
    return jobDescription.trim().length > 0 &&
           cvFiles.length > 0 &&
           cvFiles.length <= 5 &&
           consentGiven;
  }, [jobDescription, cvFiles.length, consentGiven]);

  // Performance: Optimized submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      if (!jobDescription.trim()) setError("Please provide a job description.");
      else if (cvFiles.length === 0) setError("Please upload at least one CV.");
      else if (cvFiles.length > 5) setError("Maximum 5 CVs allowed.");
      else if (!consentGiven) setError("Please consent to data processing before submitting.");
      return;
    }
    
    setIsLoading(true);
    setAnalysisResult('');
    setError(null);
    const formData = new FormData();
    formData.append('jd', jobDescription);
    cvFiles.forEach(file => { formData.append('files', file); });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(API_ROUTES.RESUME_COMPARE, {
        method: 'POST',
        body: formData,
        headers,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to get analysis.');

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setError(err?.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [isFormValid, jobDescription, cvFiles]);

  return (
    <MainLayout>
      <div className="animate-fade-in">
        <div className="glass-card p-8">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-primary hover:text-primary-400 mb-6"><ArrowLeft className="w-4 h-4" /> Back to Dashboard</button>
          <h2 className="text-2xl font-bold text-white mb-6">Compare CVs</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <textarea placeholder="Paste the full Job Description here..." className="glass-input w-full min-h-[150px]" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}/>
            <div>
              <label className="text-white/70 block mb-2">Upload Resumes (PDF, DOCX)</label>
              <div className="relative border-2 border-dashed border-white/20 rounded-lg p-6 text-center"><input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" /><div className="flex flex-col items-center"><UploadCloud className="w-12 h-12 text-primary mb-2" /><p className="text-white">Drag & drop files or <span className="text-primary font-semibold">click to browse</span></p><p className="text-xs text-white/50 mt-1">Maximum file size: 5MB</p></div></div>
            </div>
            <AnimatePresence>
              {cvFiles.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  <h3 className="text-sm font-medium text-white/80">Selected Files:</h3>
                  {cvFiles.map((file, index) => (
                    <motion.div key={index} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center justify-between text-sm glass p-2 rounded"><div className="flex items-center gap-2 text-white/80"><FileText className="w-4 h-4 text-primary"/><span>{file.name}</span></div><button type="button" onClick={() => removeFile(file.name)} className="text-white/50 hover:text-red-400 p-1"><X className="w-4 h-4"/></button></motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
              <input
                type="checkbox"
                id="data-consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50 focus:ring-2 mt-1"
                required
              />
              <label htmlFor="data-consent" className="text-sm text-white/80 leading-relaxed">
                I consent to the processing of my CV data and job descriptions by Pessoa AI for analysis purposes.
                I understand that this data will be used solely for matching CVs with job requirements and will not be shared with third parties for marketing purposes.
                <a href="/privacy" className="text-primary hover:text-primary-400 transition-colors ml-1" target="_blank" rel="noopener noreferrer">
                  Learn more in our Privacy Policy
                </a>.
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="primary-button w-full md:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  'Analyze Resumes'
                )}
              </button>
            </div>
          </form>
          {error && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{error}</div>}
          {analysisResult && <AnalysisResultBox markdownText={analysisResult} />}
        </div>
      </div>

      <ManualReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        analysisData={analysisResult}
      />
    </MainLayout>
  );
};

// Helper function to process the split sections
// --- THIS IS THE FIX for the 'any' type error ---
// We explicitly type the 'sections' parameter as an array of strings.
const parseSections = (sections: string[]) => {
  const result = [];
  for (let i = 0; i < sections.length; i += 2) {
    const title = sections[i].replace('## ', '').trim();
    const content = sections[i + 1] ? sections[i + 1].trim() : '';
    if (title) {
      result.push({ title, content });
    }
  }
  return result;
}

const AnalysisResultBox = ({ markdownText }: { markdownText: string }) => {
  const parsedContent = useMemo(() => {
    const sections = markdownText.split(/^(## PART \d: .*|## FINAL RECOMMENDATION.*$)/m).filter(s => s.trim() !== '');
    if (sections.length < 2) {
      const fallbackSections = markdownText.split(/(PART \d: .*|FINAL RECOMMENDATION.*$)/m).filter(s => s.trim() !== '');
      if (fallbackSections.length >= 2) return parseSections(fallbackSections);
      return null;
    }
    return parseSections(sections);
  }, [markdownText]);

  if (!parsedContent) {
    return (
      <div className="mt-8 pt-6 border-t border-white/10 animate-fade-in">
        <div className="result-card"><pre className="whitespace-pre-wrap font-sans text-white/80">{markdownText}</pre></div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-white/10 animate-fade-in">
      <div className="result-card space-y-8">
        {parsedContent.map((section, index) => (
          <div key={index}>
            <h2 className="text-2xl font-bold text-white mb-4">{section.title}</h2>
            {section.title.includes('RECOMMENDATION') ? (
              <p className="text-white/80 leading-relaxed">{section.content.replace(/\*\*/g, '')}</p>
            ) : (
              <RenderMarkdownTable tableString={section.content} />
            )}
          </div>
        ))}

        {/* AI Transparency Disclaimer */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
            <div className="text-sm text-blue-200 flex-1">
              <p className="font-semibold mb-1">🤖 Generated by PessoaAI</p>
              <p className="leading-relaxed">
                This analysis was created using artificial intelligence. While we strive for accuracy,
                AI-generated results should be reviewed by human experts before making employment decisions.
                The AI considers various factors including skills matching, experience alignment, and qualification compatibility.
              </p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-blue-300">
                  Not satisfied with this analysis?
                </p>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs rounded border border-blue-500/30 transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  Request Manual Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Manual Review Modal Component
const ManualReviewModal: React.FC<{ isOpen: boolean; onClose: () => void; analysisData?: string }> = ({ isOpen, onClose, analysisData }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    reason: '',
    comments: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Here you would typically send this to your backend API
    // For now, we'll just simulate a successful submission
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ name: '', email: '', reason: '', comments: '' });
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit review request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Request Manual Review</h2>
            <button onClick={onClose} className="glass-button p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Review Request Submitted!</h3>
              <p className="text-white/70">
                Our team will review your request and get back to you within 2-3 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">Your Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm mb-2">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="glass-input w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-white/80 text-sm mb-2">Reason for Review *</label>
                <select
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  className="glass-input w-full"
                  required
                >
                  <option value="">Select a reason</option>
                  <option value="disagree-with-analysis">I disagree with the AI analysis</option>
                  <option value="missing-information">Important information was missed</option>
                  <option value="bias-concern">I suspect bias in the results</option>
                  <option value="accuracy-concern">Accuracy concerns with the matching</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 text-sm mb-2">Additional Comments</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  className="glass-input w-full min-h-[100px]"
                  placeholder="Please provide any additional context or specific concerns..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="secondary-button flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="primary-button flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const RenderMarkdownTable = ({ tableString }: { tableString: string }) => {
  if (!tableString || tableString.trim() === '') return <p className="text-white/50">No data available for this section.</p>;
  const rows = tableString.trim().split('\n').filter(Boolean);
  if (rows.length < 2) return null;

  const headers = rows[0].split('|').map(h => h.trim()).filter(Boolean);
  const body = rows.slice(2).map(row => row.split('|').map(cell => cell.trim()).filter(Boolean));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left table-auto">
        <thead><tr className="border-b border-white/20">{headers.map((header, i) => <th key={i} className="p-3 text-sm font-semibold text-white/80">{header}</th>)}</tr></thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="border-b border-white/10">{row.map((cell, j) => <td key={j} className="p-3 text-sm text-white/70 align-top">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompareCVsPage;