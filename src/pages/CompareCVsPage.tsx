import React, { useState, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UploadCloud, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { API_ROUTES } from '../lib/api';

// The main CompareCVsPage component is unchanged.
const CompareCVsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    cvFiles.forEach(file => {
      formData.append('files', file);
    });

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

      if (!response.ok) {
        let detail = `Server responded with status: ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.detail) detail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        } catch (e) {
          // ignore JSON parse errors
        }
        throw new Error(detail);
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setError(err?.message || "Failed to get analysis. Please ensure the backend is running and try again.");
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
          <h2 className="text-2xl font-bold text-white mb-6">Compare CVs</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form JSX is unchanged */}
            <textarea
              placeholder="Paste the full Job Description here..."
              className="glass-input w-full min-h-[150px]"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
            <div>
              <label className="text-white/70 block mb-2">Upload Resumes (PDF, DOCX)</label>
              <div className="relative border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" />
                <div className="flex flex-col items-center">
                  <UploadCloud className="w-12 h-12 text-primary mb-2" />
                  <p className="text-white">Drag & drop files or <span className="text-primary font-semibold">click to browse</span></p>
                  <p className="text-xs text-white/50 mt-1">Maximum file size: 5MB</p>
                </div>
              </div>
            </div>
            <AnimatePresence>
              {cvFiles.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  <h3 className="text-sm font-medium text-white/80">Selected Files:</h3>
                  {cvFiles.map((file, index) => (
                    <motion.div key={index} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center justify-between text-sm glass p-2 rounded">
                      <div className="flex items-center gap-2 text-white/80"><FileText className="w-4 h-4 text-primary"/><span>{file.name}</span></div>
                      <button type="button" onClick={() => removeFile(file.name)} className="text-white/50 hover:text-red-400 p-1"><X className="w-4 h-4"/></button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="pt-2">
              <button type="submit" disabled={isLoading} className="primary-button w-full md:w-auto flex items-center justify-center gap-2">
                {isLoading ? ( <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Analyzing...</span></> ) : 'Analyze Resumes' }
              </button>
            </div>
          </form>

          {error && <div className="mt-6 text-center text-red-400 bg-red-500/10 p-4 rounded-lg">{error}</div>}
          {analysisResult && <AnalysisResultBox markdownText={analysisResult} />}
        </div>
      </div>
    </MainLayout>
  );
};

// --- THIS COMPONENT'S LOGIC IS UPDATED WITH THE FIX ---
const AnalysisResultBox = ({ markdownText }: { markdownText: string }) => {
  const parsedContent = useMemo(() => {
    const sections = markdownText.split(/(^## .*$)/m).filter(s => s.trim() !== '');
    const result = [];
    for (let i = 0; i < sections.length; i += 2) {
      const title = sections[i].replace('## ', '').trim();
      const content = sections[i + 1] ? sections[i + 1].trim() : '';
      if (title) {
        result.push({ title, content });
      }
    }
    return result;
  }, [markdownText]);

  return (
    <div className="mt-8 pt-6 border-t border-white/10 animate-fade-in">
      <div className="result-card space-y-8">
        {parsedContent.length === 0 ? (
          // Heuristic fallback: try to produce a tidy, user-friendly layout
          // even when the AI output doesn't include '##' headings.
          // - Extract a FINAL RECOMMENDATION block if present
          // - Split remaining text into blocks separated by blank lines
          // - Render blocks containing pipes '|' as tables, otherwise as paragraphs
          (() => {
            const finalMatchIndex = markdownText.search(/FINAL RECOMMENDATION\b/i);
            let mainText = markdownText;
            let finalText = '';
            if (finalMatchIndex !== -1) {
              mainText = markdownText.slice(0, finalMatchIndex).trim();
              finalText = markdownText.slice(finalMatchIndex).trim();
            }

            const blocks = mainText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

            return (
              <div className="space-y-6">
                {blocks.map((block, i) => (
                  <div key={i}>
                    {block.includes('|') ? (
                      <RenderMarkdownTable tableString={block} />
                    ) : (
                      <p className="text-white/80 leading-relaxed">{block}</p>
                    )}
                  </div>
                ))}

                {finalText ? (
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-4">FINAL RECOMMENDATION</h2>
                    <p className="text-white/80 leading-relaxed">{finalText.replace(/FINAL RECOMMENDATION[:\-\s]*/i, '').trim()}</p>
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : (
          parsedContent.map((section, index) => {
            const normalizedTitle = section.title.trim().toLowerCase();
            const isFinal = normalizedTitle.includes('final recommendation');
            return (
              <div key={index}>
                <h2 className="text-2xl font-bold text-white mb-4">{section.title}</h2>
                {isFinal ? (
                  // Normalize markdown emphasis and ensure consistent paragraph styling
                  <p className="text-white/80 leading-relaxed">
                    {section.content.replace(/(\*\*|__|\*|_)/g, '').trim()}
                  </p>
                ) : (
                  <RenderMarkdownTable tableString={section.content} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// RenderMarkdownTable remains unchanged
const RenderMarkdownTable: React.FC<{ tableString: string }> = ({ tableString }) => {
  if (!tableString || tableString.trim() === '') {
    return <p className="text-white/50">No data available for this section.</p>;
  }

  // Split into non-empty lines
  const rows = tableString.trim().split('\n').map(r => r.trim()).filter(r => r.length > 0);
  if (rows.length === 0) return null;

  // Header row is expected to be first; second row might be separator like |---|---|
  const rawHeader = rows[0];
  const headerCells = rawHeader.split('|').map(h => h.trim());

  // Remove empty leading/trailing cells produced by leading/trailing pipes
  if (headerCells.length > 0 && headerCells[0] === '') headerCells.shift();
  if (headerCells.length > 0 && headerCells[headerCells.length - 1] === '') headerCells.pop();

  const headers = headerCells;

  // Body rows: skip a separator line if present (e.g., |---|---|)
  let bodyRows = rows.slice(1);
  if (bodyRows.length > 0 && /^\s*\|?\s*-{1,}\s*(\|\s*-{1,}\s*)+\|?\s*$/.test(bodyRows[0])) {
    bodyRows = bodyRows.slice(1);
  }

  const body = bodyRows.map(r => {
    const cells = r.split('|').map(c => c.trim());
    if (cells.length > 0 && cells[0] === '') cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
    // Pad or trim to match headers length
    if (cells.length < headers.length) {
      while (cells.length < headers.length) cells.push('');
    } else if (cells.length > headers.length) {
      // keep extra columns if present
    }
    return cells;
  }).filter(row => row.some(cell => cell !== ''));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left table-auto">
        <thead>
          <tr className="border-b border-white/20">
            {headers.map((header, i) => (
              <th key={i} className="p-3 text-sm font-semibold text-white/80">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="border-b border-white/10">
              {row.map((cell, j) => (
                <td key={j} className="p-3 text-sm text-white/70 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompareCVsPage;