import { useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  FolderOpen,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { LandDocument, deleteDocument, getDocumentFileUrl, processDocument } from '../lib/api';

const DOCUMENT_TYPES = [
  { value: 'ALL', label: 'All Record Types' },
  { value: 'title_deed', label: 'Title Deeds' },
  { value: 'sale_deed', label: 'Sale Deeds' },
  { value: 'khata', label: 'Khata / Patta / RoR' },
  { value: 'survey_map', label: 'Survey Maps' },
  { value: 'mutation_record', label: 'Mutation Records' },
  { value: 'tax_receipt', label: 'Tax Receipts' },
  { value: 'other', label: 'Other Documents' },
];

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending Verification' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'DIGITIZED', label: 'Digitized' },
  { value: 'FAILED', label: 'Failed' },
];

interface DocumentListProps {
  documents: LandDocument[];
  isLoading: boolean;
  onRefresh: () => void;
  onPreview: (doc: LandDocument) => void;
  onDeleteSuccess: (id: number) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedType: string;
  setSelectedType: (t: string) => void;
  selectedStatus: string;
  setSelectedStatus: (s: string) => void;
}

export function DocumentList({
  documents,
  isLoading,
  onRefresh,
  onPreview,
  onDeleteSuccess,
  searchTerm,
  setSearchTerm,
  selectedType,
  setSelectedType,
  selectedStatus,
  setSelectedStatus,
}: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleDelete = async (doc: LandDocument) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.title}"?`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      onDeleteSuccess(doc.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async (doc: LandDocument) => {
    setProcessingId(doc.id);
    try {
      await processDocument(doc.id);
      setTimeout(() => {
        onRefresh();
      }, 1500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to process document');
    } finally {
      setProcessingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* Search and Filters Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by title, parcel ID, text, or district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Document Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs font-medium py-2 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-medium py-2 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition"
            title="Refresh repository"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Documents Table / Empty State */}
      {isLoading && documents.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Loading land records repository...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No land records found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedType !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Try adjusting your search criteria or clear filters.'
              : 'Upload your first land document above to begin digitizing records.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Document Title & File</th>
                <th className="px-4 py-3">Record Type</th>
                <th className="px-4 py-3">Language & Script</th>
                <th className="px-4 py-3">Parcel / Jurisdiction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Document Title & File */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate max-w-xs sm:max-w-sm">
                        <div
                          onClick={() => onPreview(doc)}
                          className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer truncate"
                        >
                          {doc.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {doc.original_filename} • {formatFileSize(doc.file_size)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Record Type */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                      {doc.document_type.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Language & Script */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {doc.detected_language ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {doc.detected_script || doc.detected_language.toUpperCase()}
                        </span>
                        {doc.ocr_confidence && (
                          <span className="text-[11px] text-slate-500">
                            {Math.round(doc.ocr_confidence)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not analyzed</span>
                    )}
                  </td>

                  {/* Parcel / Jurisdiction */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="text-xs">
                      {doc.parcel_identifier && (
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {doc.parcel_identifier}
                        </div>
                      )}
                      <div className="text-slate-500 dark:text-slate-400">
                        {[doc.district, doc.state].filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.status === 'DIGITIZED'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : doc.status === 'PROCESSING'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : doc.status === 'FAILED'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {doc.status === 'DIGITIZED' && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status === 'PROCESSING' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {doc.status}
                    </span>
                  </td>

                  {/* Date Uploaded */}
                  <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {new Date(doc.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      {doc.status !== 'DIGITIZED' && (
                        <button
                          onClick={() => handleProcess(doc)}
                          disabled={processingId === doc.id || doc.status === 'PROCESSING'}
                          className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                          title="Run OCR / Preprocessing Pipeline"
                        >
                          <Sparkles className={`w-4 h-4 ${processingId === doc.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}

                      <button
                        onClick={() => onPreview(doc)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                        title="Preview Document & OCR"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <a
                        href={getDocumentFileUrl(doc.id, true)}
                        download={doc.original_filename}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                        title="Download Original File"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleDelete(doc)}
                        disabled={deletingId === doc.id}
                        className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
