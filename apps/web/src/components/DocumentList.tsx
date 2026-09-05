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
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  MapPin,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { LandDocument, deleteDocument, getDocumentFileUrl, processDocument } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to run OCR & field extraction pipeline');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DIGITIZED':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[11px]">
            <CheckCircle2 className="w-3 h-3" />
            DIGITIZED
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="info" className="gap-1 font-mono text-[11px] animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            PROCESSING
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[11px]">
            <AlertTriangle className="w-3 h-3" />
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
            <Clock className="w-3 h-3" />
            PENDING
          </Badge>
        );
    }
  };

  const formatDocType = (type: string) => {
    return type.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border/80 rounded-xl shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title, parcel ID, district, or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Record Type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onRefresh}
            title="Refresh repository"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Document Grid / Table View */}
      {isLoading && documents.length === 0 ? (
        <div className="py-16 text-center bg-card border border-border/60 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Loading land records...</p>
          <p className="text-xs text-muted-foreground">Connecting to state digitization catalog</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-16 text-center bg-card border border-border/60 rounded-xl space-y-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No land records found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchTerm || selectedType !== 'ALL' || selectedStatus !== 'ALL'
              ? 'Try changing your search keywords or filter criteria.'
              : 'Upload scanned land documents above to run multilingual OCR and field extraction.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const hasExtracted = doc.extracted_data && (doc.extracted_data.owners?.length || doc.extracted_data.survey_number);
            const isDeleting = deletingId === doc.id;
            const isProcessing = processingId === doc.id || doc.status === 'PROCESSING';

            return (
              <Card
                key={doc.id}
                className="group border border-border/80 hover:border-foreground/30 transition-all hover:shadow-xs flex flex-col justify-between overflow-hidden bg-card"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar: Type + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
                      {formatDocType(doc.document_type)}
                    </span>
                    {getStatusBadge(doc.status)}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h4
                      onClick={() => onPreview(doc)}
                      className="font-semibold text-sm text-foreground hover:text-primary transition line-clamp-1 cursor-pointer"
                      title={doc.title}
                    >
                      {doc.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1 font-mono text-[11px]">
                      {doc.original_filename}
                    </p>
                  </div>

                  {/* Key Land Identifiers */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono block">Parcel / Survey</span>
                      <span className="font-medium text-foreground text-xs truncate block">
                        {doc.parcel_identifier || doc.extracted_data?.survey_number?.value || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono block">District / State</span>
                      <span className="font-medium text-foreground text-xs truncate block">
                        {doc.district ? `${doc.district}${doc.state ? `, ${doc.state}` : ''}` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Certificate Summary (if available) */}
                  {hasExtracted && (
                    <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
                          Extracted Owners ({doc.extracted_data?.owners?.length || 0})
                        </span>
                        {doc.extracted_data?.overall_confidence ? (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {doc.extracted_data.overall_confidence}% conf.
                          </span>
                        ) : null}
                      </div>
                      {doc.extracted_data?.owners && doc.extracted_data.owners.length > 0 && (
                        <p className="font-medium text-foreground text-xs truncate">
                          {doc.extracted_data.owners.map((o) => o.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Date & Size info */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1">
                    <span>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>

                {/* Footer action buttons */}
                <div className="px-5 py-3 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => onPreview(doc)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Inspect
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a
                        href={getDocumentFileUrl(doc.id, true)}
                        download={doc.original_filename}
                        title="Download Original File"
                      >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {doc.status !== 'DIGITIZED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-foreground"
                        onClick={() => handleProcess(doc)}
                        disabled={isProcessing}
                        title="Run Multilingual OCR + Field Extractor"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 mr-1 text-foreground" />
                            Run Pipeline
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(doc)}
                      disabled={isDeleting}
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
