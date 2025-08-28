import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import { supabase } from '../lib/supabaseClient';
import { API_ROUTES } from '../lib/api';
import authFetch from '../lib/authFetch';
import { Upload, Search, Trash2, Download, X, Briefcase, Mail, Phone, MapPin, BrainCircuit, BookOpen, FileCheck2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Define the type for our resume object
interface Resume {
  id: number;
  name: string;
  job_title: string;
  email: string | null;
  phone_number: string | null;
  location: string | null;
  work_experience_summary: string | null;
  skills_summary: string | null;
  education_summary: string | null;
  file_name: string;
  storage_path: string;
}

// THE MAIN PAGE COMPONENT
const ResumeBankPage: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [, setLoading] = useState(true);
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // State for search input
  const [uploadConsentGiven, setUploadConsentGiven] = useState(false);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    // Fetches resumes for the currently logged-in user
    const { data, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('uploaded_at', { ascending: false });
      
    if (data) setResumes(data);
    if (error) console.error("Error fetching resumes:", error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

  await authFetch(API_ROUTES.RESUMES, {
          method: 'DELETE',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ ids }),
      });
      fetchResumes();
      setSelectedRows(new Set());
      setSelectedResume(null);
    } catch (error) {
      console.error("Failed to delete resumes:", error);
    }
  };
  
  const handleDownload = async (resume: Resume) => {
    try {
      const { data, error } = await supabase.storage.from('cv_uploads').download(resume.storage_path);
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = resume.file_name || 'resume';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file.');
    }
  };

  // --- SEARCH LOGIC ---
  const filteredResumes = useMemo(() => {
    if (!searchTerm.trim()) return resumes;
    return resumes.filter(resume =>
      resume.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resume.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [resumes, searchTerm]);

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-white">Resume Bank</h1>
        <div className="flex justify-between items-center glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
            <input 
              type="text" 
              placeholder="Search by name or title..." 
              className="glass-input pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <button className="secondary-button" disabled={selectedRows.size === 0} onClick={() => handleDelete(Array.from(selectedRows))}><Trash2 className="w-4 h-4 mr-2" /> Delete Selected</button>
            <button className="primary-button" onClick={() => setIsUploadModalOpen(true)}><Upload className="w-4 h-4 mr-2" />Upload CVs</button>
          </div>
        </div>
        <div className="glass-card overflow-hidden">
          <ResumeTable resumes={filteredResumes} selectedRows={selectedRows} setSelectedRows={setSelectedRows} onRowClick={setSelectedResume} onDownload={handleDownload}/>
        </div>
      </div>
      <AnimatePresence>
        {selectedResume && <ProfileSidebar key="sidebar" resume={selectedResume} onClose={() => setSelectedResume(null)} onDelete={() => handleDelete([selectedResume.id])} onDownload={handleDownload} />}
        {isUploadModalOpen && <UploadModal key="modal" onClose={() => setIsUploadModalOpen(false)} onUploadComplete={fetchResumes} />}
      </AnimatePresence>
    </MainLayout>
  );
};

// --- TABLE COMPONENT ---
const ResumeTable: React.FC<{resumes: Resume[], selectedRows: Set<number>, setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>, onRowClick: (resume: Resume) => void, onDownload: (resume: Resume) => void}> = ({ resumes, selectedRows, setSelectedRows, onRowClick, onDownload }) => {
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.checked) setSelectedRows(new Set(resumes.map(r => r.id))); else setSelectedRows(new Set()); };
  const handleSelectRow = (id: number) => { const newSelection = new Set(selectedRows); if (newSelection.has(id)) newSelection.delete(id); else newSelection.add(id); setSelectedRows(newSelection); };
  return (
    <table className="w-full text-left">
      <thead><tr className="border-b border-white/10 bg-white/5">
          <th className="p-4 w-12"><input type="checkbox" onChange={handleSelectAll} className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50" /></th>
          <th className="p-4 text-sm font-semibold text-white/80">Name</th>
          <th className="p-4 text-sm font-semibold text-white/80">Job Title</th>
          <th className="p-4 text-sm font-semibold text-white/80 text-right">Actions</th>
      </tr></thead>
      <tbody>
        {resumes.map(resume => (
          <tr key={resume.id} className="border-b border-white/5 hover:bg-white/10 cursor-pointer" onClick={() => onRowClick(resume)}>
            <td className="p-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedRows.has(resume.id)} onChange={() => handleSelectRow(resume.id)} className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50" /></td>
            <td className="p-4 text-white font-medium">{resume.name || 'N/A'}</td>
            <td className="p-4 text-white/70">{resume.job_title || 'N/A'}</td>
            <td className="p-4 text-right"><button className="glass-button p-2" onClick={(e) => {e.stopPropagation(); onDownload(resume);}}><Download className="w-4 h-4" /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// --- PROFILE SIDEBAR COMPONENT ---
const ProfileSidebar: React.FC<{resume: Resume, onClose: () => void, onDelete: () => void, onDownload: (resume: Resume) => void}> = ({ resume, onClose, onDelete, onDownload }) => {
    return (
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-background/80 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white">Applicant Profile</h2>
                <button onClick={onClose} className="glass-button p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-grow p-6 space-y-6 overflow-y-auto">
                <div><h3 className="text-2xl font-bold text-white">{resume.name}</h3><p className="text-primary font-medium">{resume.job_title}</p></div>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-white/80"><Mail className="w-4 h-4 text-primary" /><span>{resume.email || 'Not found'}</span></div>
                    <div className="flex items-center gap-3 text-white/80"><Phone className="w-4 h-4 text-primary" /><span>{resume.phone_number || 'Not found'}</span></div>
                    <div className="flex items-center gap-3 text-white/80"><MapPin className="w-4 h-4 text-primary" /><span>{resume.location || 'Not found'}</span></div>
                </div>
                <div className="space-y-4">
                    <div><h4 className="font-semibold text-white mb-2 flex items-center gap-2"><Briefcase className="w-4 h-4" />Work Experience</h4><p className="text-sm text-white/70 leading-relaxed">{resume.work_experience_summary}</p></div>
                    <div><h4 className="font-semibold text-white mb-2 flex items-center gap-2"><BrainCircuit className="w-4 h-4" />Skills</h4><p className="text-sm text-white/70 leading-relaxed">{resume.skills_summary}</p></div>
                    <div><h4 className="font-semibold text-white mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4" />Education</h4><p className="text-sm text-white/70 leading-relaxed">{resume.education_summary}</p></div>
                </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-4 p-4 border-t border-white/10">
                <button onClick={() => onDownload(resume)} className="primary-button flex-1 flex items-center justify-center"><Download className="w-4 h-4 mr-2"/><span>Download CV</span></button>
                <button onClick={onDelete} className="secondary-button text-red-400 border-red-400/30 hover:text-red-300 hover:border-red-400/50 p-3"><Trash2 className="w-5 h-5" /></button>
            </div>
        </motion.div>
    );
};

// --- UPLOAD MODAL COMPONENT ---
const UploadModal: React.FC<{ onClose: () => void; onUploadComplete: () => void }> = ({ onClose, onUploadComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: 'uploading' | 'success' | 'error' }>({});
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!consentGiven) {
      setError("Please consent to data processing before uploading.");
      return;
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setError("Authentication error. Please log in again.");
      return;
    }

    setUploading(true);
    setError(null);
    let allSuccessful = true;

    const uploadPromises = files.map(async file => {
      setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await authFetch(API_ROUTES.RESUME_UPLOAD, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Upload failed on the server.');
        setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
      } catch (err) {
        allSuccessful = false;
        setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
      }
    });

    await Promise.all(uploadPromises);
    setUploading(false);
    onUploadComplete();
    if (allSuccessful) setTimeout(onClose, 1000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="glass-card w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Upload Resumes</h2>
          <button onClick={onClose} className="glass-button p-2"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="relative border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
            <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" />
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-primary mb-2" />
              <p className="text-white">Drag & drop files or <span className="text-primary font-semibold">click to browse</span></p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto p-1">
              {files.map(file => (
                <div key={file.name} className="flex items-center justify-between text-sm glass p-2 rounded">
                  <span className="text-white/80 truncate pr-4">{file.name}</span>
                  <div className="flex-shrink-0">
                    {uploadStatus[file.name] === 'uploading' && <div className="w-4 h-4 border-2 border-white/30 border-t-primary rounded-full animate-spin" />}
                    {uploadStatus[file.name] === 'success' && <FileCheck2 className="w-4 h-4 text-green-400" />}
                    {uploadStatus[file.name] === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-red-400 text-sm text-center">{error}</div>}

          <div className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg">
            <input
              type="checkbox"
              id="upload-consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="w-4 h-4 text-primary bg-transparent border-white/30 rounded focus:ring-primary/50 focus:ring-2 mt-1"
              required
            />
            <label htmlFor="upload-consent" className="text-xs text-white/70 leading-relaxed">
              I consent to the processing of my CV data by Pessoa AI for storage and analysis purposes.
              <a href="/privacy" className="text-primary hover:text-primary-400 transition-colors ml-1" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>.
            </label>
          </div>

          <button className="primary-button w-full" onClick={handleUpload} disabled={uploading || files.length === 0 || !consentGiven}>
            {uploading ? 'Processing...' : `Upload ${files.length} File(s)`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ResumeBankPage;