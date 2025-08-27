import React, { useState, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';

// Main CompareCVsPage component
const CompareCVsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- THIS IS THE FIX for the 'null' type error ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // We add a check to ensure e.target.files is not null before proceeding.
    if (e.target.files) {
      setCvFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };
  
  const removeFile = (fileName: string) => {
    setCvFiles(prev => prev.filter(file => file.name !== fileName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription || cvFiles.length === 0) {
      setError("Please provide a job description and at least one CV.");
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

      const response = await fetch('http://127.0.0.1:8000/resumes/compare', {
        method: 'POST', body: formData, headers,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to get analysis.');
      
      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setError(err?.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="pt-2"><button type="submit" disabled={isLoading} className="primary-button w-full md:w-auto flex items-center justify-center gap-2">{isLoading ? ( <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Analyzing...</span></> ) : 'Analyze Resumes' }</button></div>
          </form>
          {error && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{error}</div>}
          {analysisResult && <AnalysisResultBox markdownText={analysisResult} />}
        </div>
      </div>
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
      </div>
    </div>
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