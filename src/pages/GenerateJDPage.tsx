import React, { useState, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import CustomSelect from '../components/common/CustomSelect';
import { API_ROUTES } from '../lib/api';
import authFetch from '../lib/authFetch';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';

const GenerateJDPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    jobTitle: '',
    requirements: '',
    responsibilities: '',
    skills: '',
    location: '',
  });
  const [jobType, setJobType] = useState('Full-time');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedJD, setGeneratedJD] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const jobTypeOptions = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      setError("Please consent to data processing before generating.");
      return;
    }
    setIsLoading(true);
    setGeneratedJD('');
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.GENERATE_JD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: formData.jobTitle,
          job_type: jobType,
          location: formData.location,
          responsibilities: formData.responsibilities,
          requirements: formData.requirements,
          skills: formData.skills,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      setGeneratedJD(data.job_description);
    } catch (err) {
      setError("Failed to connect to the AI service. Please ensure the backend is running and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        <div className="glass-card p-8">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-primary hover:text-primary-400 mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-white mb-6">Generate a Job Description</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} type="text" placeholder="Job Title" className="glass-input w-full" />
              <CustomSelect options={jobTypeOptions} value={jobType} onChange={setJobType} />
            </div>
            <textarea name="requirements" value={formData.requirements} onChange={handleInputChange} placeholder="Requirements" className="glass-input w-full min-h-[100px]" />
            <textarea name="responsibilities" value={formData.responsibilities} onChange={handleInputChange} placeholder="Responsibilities" className="glass-input w-full min-h-[100px]" />
            <input name="skills" value={formData.skills} onChange={handleInputChange} type="text" placeholder="Skills (comma-separated)" className="glass-input w-full" />
            <input name="location" value={formData.location} onChange={handleInputChange} type="text" placeholder="Location" className="glass-input w-full" />

            <div className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg">
              <input
                type="checkbox"
                id="jd-consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50 focus:ring-2 mt-1"
                required
              />
              <label htmlFor="jd-consent" className="text-sm text-white/80 leading-relaxed">
                I consent to the processing of my job description data by Pessoa AI for generation purposes.
                I understand that this data will be used solely for creating job descriptions and will not be shared with third parties for marketing purposes.
                <a href="/privacy" className="text-primary hover:text-primary-400 transition-colors ml-1" target="_blank" rel="noopener noreferrer">
                  Learn more in our Privacy Policy
                </a>.
              </label>
            </div>

            <div className="pt-4">
              <button type="submit" className="primary-button w-full md:w-auto flex items-center justify-center gap-2" disabled={isLoading || !consentGiven}>
                {isLoading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Generating...</span></>
                ) : ( 'Generate with AI' )}
              </button>
            </div>
          </form>

          {error && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{error}</div>}
          {generatedJD && <GenerationResultBox jdText={generatedJD} />}
        </div>
      </div>
    </MainLayout>
  );
};

// --- RESTORED: The beautifully formatted result box ---
const GenerationResultBox = ({ jdText }: { jdText: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const parsedContent = useMemo(() => {
    const lines = jdText.split('\n').filter(line => line.trim().length > 0);
    let title = "Job Description";
    let subtitle = "";
    const sections: { title: string; items: string[] }[] = [];
    
    if (lines[0]?.startsWith('## ')) {
      title = lines[0].replace('## ', '').trim();
      if (lines[1] && !lines[1].startsWith('## ')) {
        subtitle = lines[1].trim();
      }
    }
    let currentSection: { title: string; items: string[] } | null = null;
    lines.forEach(line => {
      if (line.startsWith('## ')) {
        if (currentSection) sections.push(currentSection);
        currentSection = { title: line.replace('## ', '').trim(), items: [] };
      } else if (currentSection && line.trim() && !line.includes("Location:") && !line.includes("Type:")) {
        currentSection.items.push(line.replace(/^[*\-]\s*/, '').trim());
      }
    });
    if (currentSection) sections.push(currentSection);
    const mainSections = sections.filter(sec => sec.title !== title);
    return { title, subtitle, mainSections };
  }, [jdText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jdText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="mt-8 pt-6 border-t border-white/10 animate-fade-in">
      <div className="relative result-card">
        <button onClick={handleCopy} title="Copy Text" className="absolute top-6 right-6 glass-button p-2 z-10">
          {isCopied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
        </button>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">{parsedContent.title}</h2>
          {parsedContent.subtitle && <p className="text-sm text-white/60 -mt-2 mb-6">{parsedContent.subtitle}</p>}
          {parsedContent.mainSections.map((section, index) => (
            <div key={index} className="pt-2">
              <h3 className="text-lg font-semibold text-white mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start">
                    <span className="text-primary mr-3 mt-1">&#8226;</span>
                    <span className="text-white/80 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* AI Transparency Disclaimer */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
              <div className="text-sm text-blue-200">
                <p className="font-semibold mb-1">🤖 Generated by PessoaAI</p>
                <p className="leading-relaxed">
                  This job description was created using artificial intelligence based on the information you provided.
                  We recommend reviewing and customizing the content to match your specific organizational needs and requirements.
                </p>
                <p className="mt-2 text-xs text-blue-300">
                  AI-generated content should be reviewed by HR professionals before use.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateJDPage;