import { useState, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Layers,
  FileCheck,
  Clock,
  Plus,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { fetchDocuments, LandDocument } from '../lib/api';
import { DocumentUploadZone } from '../components/DocumentUploadZone';
import { DocumentList } from '../components/DocumentList';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  const [documents, setDocuments] = useState<LandDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<LandDocument | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [showUploadSection, setShowUploadSection] = useState(true);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDocuments({
        search: searchTerm.trim() || undefined,
        document_type: selectedType,
        status: selectedStatus,
      });
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedType, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDocuments();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadDocuments]);

  const handleUploadSuccess = (newDoc: LandDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
  };

  const handleDeleteSuccess = (deletedId: number) => {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
  };

  // Stats calculation
  const totalCount = documents.length;
  const digitizedCount = documents.filter((d) => d.status === 'DIGITIZED').length;
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-100/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  LRDS
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Digitization Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Land Records Digitization & Verification System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadSection((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {showUploadSection ? 'Hide Uploader' : 'New Upload'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Land Records</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Digitized & Verified</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{digitizedCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Verification</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{pendingCount}</h3>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {showUploadSection && (
          <section className="animate-in fade-in duration-200">
            <DocumentUploadZone onUploadSuccess={handleUploadSuccess} />
          </section>
        )}

        {/* Document Repository Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Land Records Repository
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search, inspect, and manage uploaded deeds, maps, and land certificates.
              </p>
            </div>
          </div>

          <DocumentList
            documents={documents}
            isLoading={isLoading}
            onRefresh={loadDocuments}
            onPreview={(doc) => setPreviewDoc(doc)}
            onDeleteSuccess={handleDeleteSuccess}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
          />
        </section>
      </main>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
