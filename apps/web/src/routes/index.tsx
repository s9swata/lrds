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
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Vercel-style Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-xs tracking-wider shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-foreground">
                  LRDS
                </span>
                <span className="text-muted-foreground text-xs">/</span>
                <span className="text-xs font-medium text-muted-foreground">
                  Land Record Digitization
                </span>
                <Badge variant="vercel" className="text-[10px] py-0 px-2 font-mono">
                  v0.1.0
                </Badge>
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/80 shadow-2xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Total Land Records
                </p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {totalCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-lg bg-muted text-foreground">
                <Building2 className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-2xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Digitized & Verified
                </p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {digitizedCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-2xs">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  Pending Verification
                </p>
                <h3 className="text-2xl font-bold tracking-tight text-foreground">
                  {pendingCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <section className="animate-in fade-in duration-150">
          <DocumentUploadZone onUploadSuccess={handleUploadSuccess} />
        </section>

        {/* Repository Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-foreground" />
                Land Records Repository & Verification
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Search, inspect, and run OCR & field extraction on uploaded deed scans and certificates.
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

      {/* Document Preview & Extraction Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
