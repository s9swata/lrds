import { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Calendar,
  MapPin,
  Tag,
  Hash,
  Copy,
  Check,
  Languages,
  Eye,
  Sliders,
  ShieldCheck,
  User,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { LandDocument, LandOwner, LandRecordCertificate, getDocumentFileUrl } from '../lib/api';

interface DocumentPreviewModalProps {
  document: LandDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [showProcessed, setShowProcessed] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'certificate' | 'ocr'>('scan');
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const originalUrl = getDocumentFileUrl(document.id);
  const processedUrl = getDocumentFileUrl(document.id, false, true);
  const downloadUrl = getDocumentFileUrl(document.id, true);
  const isPdf = document.mime_type.includes('pdf');
  const isImage = document.mime_type.startsWith('image/');
  const extracted: LandRecordCertificate = document.extracted_data || {};

  const handleCopyText = () => {
    if (document.raw_text) {
      navigator.clipboard.writeText(document.raw_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850/60">
          <div className="flex items-center gap-3 truncate">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {document.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {document.original_filename} • {(document.file_size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>

          {/* Tab Selector & Controls */}
          <div className="flex items-center gap-3">
            <div className="flex p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveTab('scan')}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === 'scan'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Document Scan
              </button>
              <button
                onClick={() => setActiveTab('certificate')}
                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
                  activeTab === 'certificate'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                Digital Certificate
              </button>
              <button
                onClick={() => setActiveTab('ocr')}
                className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
                  activeTab === 'ocr'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Languages className="w-3.5 h-3.5 text-slate-400" />
                OCR & Script
              </button>
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-3">
              <a
                href={downloadUrl}
                download={document.original_filename}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                title="Download Original"
              >
                <Download className="w-4 h-4" />
              </a>
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 overflow-hidden">
          {/* Main Visual / OCR / Certificate Area */}
          <div className="md:col-span-3 bg-slate-950/90 flex flex-col relative overflow-hidden">
            {activeTab === 'scan' ? (
              <>
                {/* Image Toggle Bar (Original vs Preprocessed) */}
                {document.processed_file_path && (
                  <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white rounded-lg p-1 flex items-center gap-1 text-xs shadow-md">
                    <button
                      onClick={() => setShowProcessed(false)}
                      className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition ${
                        !showProcessed ? 'bg-indigo-600 text-white font-medium' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" /> Original Scan
                    </button>
                    <button
                      onClick={() => setShowProcessed(true)}
                      className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition ${
                        showProcessed ? 'bg-indigo-600 text-white font-medium' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" /> OpenCV Preprocessed
                    </button>
                  </div>
                )}

                {/* Preview Frame */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  {isPdf && !showProcessed ? (
                    <iframe
                      src={`${originalUrl}#toolbar=1`}
                      title={document.title}
                      className="w-full h-full rounded-lg border border-slate-800 bg-white"
                    />
                  ) : isImage || showProcessed ? (
                    <div className="overflow-auto max-h-full flex items-center justify-center">
                      <img
                        src={showProcessed ? processedUrl : originalUrl}
                        alt={document.title}
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                        className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-100"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <FileText className="w-16 h-16 mx-auto mb-3 opacity-40" />
                      <p>Preview not available directly for this file format.</p>
                      <a
                        href={downloadUrl}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                      >
                        <Download className="w-4 h-4" /> Download File
                      </a>
                    </div>
                  )}
                </div>

                {/* Zoom Controls */}
                {(isImage || showProcessed) && (
                  <div className="absolute bottom-4 right-4 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 backdrop-blur-xs border border-slate-700">
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      className="hover:text-indigo-400 px-1 font-bold"
                    >
                      -
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                      className="hover:text-indigo-400 px-1 font-bold"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setZoom(1)}
                      className="hover:text-indigo-400 text-[10px] uppercase ml-1"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === 'certificate' ? (
              /* Structured Digital Land Record Certificate */
              <div className="flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-100 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-400" />
                      Structured Land Record Certificate
                    </h4>
                    <p className="text-xs text-slate-400">
                      Standardized statutory data extracted via deterministic Indic Lexicon & Spatial Engine.
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      extracted.verification_status === 'VERIFIED'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {extracted.verification_status === 'VERIFIED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {extracted.verification_status || 'NEEDS_REVIEW'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Ownership Details Card */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" /> Ownership & Pattadar
                    </span>
                    {extracted.owners && extracted.owners.length > 0 ? (
                      extracted.owners.map((owner: LandOwner, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                          <p className="font-semibold text-white text-base">{owner.name}</p>
                          <p className="text-xs text-indigo-400">{owner.relation || 'Pattadar'}</p>
                          {owner.guardian_name && (
                            <p className="text-xs text-slate-400 mt-1">Father/Spouse: {owner.guardian_name}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No primary owner extracted automatically</p>
                    )}
                  </div>

                  {/* Parcel & Survey Identifiers */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-400" /> Parcel & Survey Numbers
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-xs text-slate-500 block">Survey / Plot No.</span>
                        <span className="font-bold text-white text-base">
                          {extracted.survey_number?.value || document.parcel_identifier || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-xs text-slate-500 block">Khata / Patta No.</span>
                        <span className="font-bold text-white text-base">
                          {extracted.khata_number?.value || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extent & Land Area */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-400" /> Extent & Area
                    </span>
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-white">
                          {extracted.area_extent?.value ? `${extracted.area_extent.value} ${extracted.area_extent.unit}` : extracted.area_extent?.raw || '—'}
                        </span>
                        {extracted.area_extent?.sq_meters && (
                          <span className="text-xs text-indigo-400 font-mono">
                            ≈ {extracted.area_extent.sq_meters} sq.m
                          </span>
                        )}
                      </div>
                      {extracted.area_extent?.raw && (
                        <span className="text-xs text-slate-500 block mt-1 font-mono truncate">
                          Raw: {extracted.area_extent.raw}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Jurisdiction & Village */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Location Hierarchy
                    </span>
                    <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80 space-y-1 text-xs">
                      <p className="text-slate-300"><strong className="text-slate-500">Village/Mouza:</strong> {extracted.location?.village || 'Not specified'}</p>
                      <p className="text-slate-300"><strong className="text-slate-500">District:</strong> {extracted.location?.district || document.district || 'Not specified'}</p>
                      <p className="text-slate-300"><strong className="text-slate-500">State:</strong> {extracted.location?.state || document.state || 'Not specified'}</p>
                    </div>
                  </div>

                  {/* Statutory Dates & Registration Timeline */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 md:col-span-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Registration & Issue Dates
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-xs text-slate-500 block">Deed Execution / Registration Date</span>
                        <span className="font-bold text-white text-base">
                          {extracted.registration_date?.value || '—'}
                        </span>
                        {extracted.registration_date?.raw && (
                          <span className="text-xs text-slate-400 block mt-0.5">Raw: {extracted.registration_date.raw}</span>
                        )}
                      </div>
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                        <span className="text-xs text-slate-500 block">Certified Copy Issue Date</span>
                        <span className="font-bold text-white text-base">
                          {extracted.issue_date?.value || '—'}
                        </span>
                        {extracted.issue_date?.raw && (
                          <span className="text-xs text-slate-400 block mt-0.5">Raw: {extracted.issue_date.raw}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* OCR Extracted Text Panel */
              <div className="flex-1 p-6 flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">Extracted Document Text</h4>
                      <p className="text-xs text-slate-400">
                        Preserves native Indic characters, punctuation, and layout.
                      </p>
                    </div>
                  </div>
                  {document.raw_text && (
                    <button
                      onClick={handleCopyText}
                      className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Text'}
                    </button>
                  )}
                </div>

                <div className="flex-1 mt-4 overflow-y-auto font-mono text-sm bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                  {document.raw_text || (
                    <div className="text-center text-slate-500 py-12">
                      <p>No OCR text extracted yet.</p>
                      <p className="text-xs mt-1">Run the preprocessing & OCR pipeline to parse this document.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata & Analysis Sidebar */}
          <div className="p-5 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto space-y-5 text-sm">
            {/* Language & Script Section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Script & Language Analysis
              </h4>
              <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Detected Script</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {document.detected_script || 'Not detected'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Language Code</span>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {document.detected_language ? document.detected_language.toUpperCase() : '—'}
                  </span>
                </div>

                {document.ocr_confidence && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">OCR Confidence</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {Math.round(document.ocr_confidence)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          document.ocr_confidence > 75
                            ? 'bg-emerald-500'
                            : document.ocr_confidence > 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${document.ocr_confidence}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Record Details */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Record Details
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Tag className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-500 block">Record Type</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                      {document.document_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-500 block">Parcel / Plot ID</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {document.parcel_identifier || 'Not Specified'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-500 block">Jurisdiction</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {[document.district, document.state].filter(Boolean).join(', ') ||
                        'Not Specified'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-slate-500 block">Uploaded At</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {new Date(document.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Processing Status
              </h4>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  document.status === 'DIGITIZED'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : document.status === 'PROCESSING'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                }`}
              >
                {document.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
