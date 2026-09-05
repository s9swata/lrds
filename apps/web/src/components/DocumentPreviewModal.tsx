import { useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Calendar,
  MapPin,
  Hash,
  Copy,
  Check,
  Languages,
  ShieldCheck,
  User,
} from 'lucide-react';
import { LandDocument, LandRecordCertificate, getDocumentFileUrl } from '../lib/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DocumentPreviewModalProps {
  document: LandDocument | null;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [showProcessed, setShowProcessed] = useState(false);
  const [activeTab, setActiveTab] = useState<'scan' | 'certificate' | 'ocr'>('certificate');
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const originalUrl = getDocumentFileUrl(document.id);
  const processedUrl = getDocumentFileUrl(document.id, false, true);
  const downloadUrl = getDocumentFileUrl(document.id, true);
  const isPdf = document.mime_type.includes('pdf');
  const extracted: LandRecordCertificate = document.extracted_data || {};

  const handleCopyText = () => {
    if (document.raw_text) {
      navigator.clipboard.writeText(document.raw_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getConfidenceBadge = (conf?: number | null) => {
    if (conf === undefined || conf === null) return null;
    const score = Math.round(conf <= 1 ? conf * 100 : conf);
    if (score >= 80) {
      return (
        <Badge variant="success" className="text-[10px] font-mono">
          {score}% Confidence
        </Badge>
      );
    }
    if (score >= 50) {
      return (
        <Badge variant="warning" className="text-[10px] font-mono">
          {score}% Confidence
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-[10px] font-mono">
        {score}% Confidence
      </Badge>
    );
  };

  return (
    <Dialog open={!!document} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden border border-border bg-card">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2.5 bg-foreground text-background rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground truncate">
                  {document.title}
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {document.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
                {document.original_filename} • {(document.file_size / (1024 * 1024)).toFixed(2)} MB • {document.mime_type}
              </DialogDescription>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-2 pr-8">
            <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5">
              <a href={downloadUrl} download={document.original_filename}>
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs gap-1.5">
              <a href={originalUrl} target="_blank" rel="noreferrer">
                Raw View
              </a>
            </Button>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="px-6 py-2 border-b border-border bg-muted/10 flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'scan' | 'certificate' | 'ocr')}>
            <TabsList className="h-8 bg-muted">
              <TabsTrigger value="certificate" className="text-xs gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
                Digital Certificate
              </TabsTrigger>
              <TabsTrigger value="scan" className="text-xs gap-1.5">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                Document Scan
              </TabsTrigger>
              <TabsTrigger value="ocr" className="text-xs gap-1.5">
                <Languages className="w-3.5 h-3.5 text-muted-foreground" />
                OCR & Raw Text
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {document.detected_language && (
              <Badge variant="secondary" className="text-xs font-mono">
                {document.detected_language.toUpperCase()} ({document.detected_script || 'Indic'})
              </Badge>
            )}
            {getConfidenceBadge(document.ocr_confidence)}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {/* TAB 1: DIGITAL CERTIFICATE */}
          {activeTab === 'certificate' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Status Banner */}
              <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Statutory Land Record Certificate
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Structured extraction from OpenCV Preprocessing + Multilingual Indic OCR + Statutory Lexicon
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={extracted.verification_status === 'VERIFIED' ? 'success' : 'secondary'}
                    className="font-mono text-xs px-2.5 py-1"
                  >
                    {extracted.verification_status || (document.status === 'DIGITIZED' ? 'VERIFIED' : 'PENDING REVIEW')}
                  </Badge>
                </div>
              </div>

              {/* Certificate Layout Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Ownership Details */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User className="w-4 h-4 text-foreground" />
                      Land Ownership & Title Holders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {extracted.owners && extracted.owners.length > 0 ? (
                      extracted.owners.map((owner, idx) => (
                        <div key={idx} className="p-3 bg-muted/40 border border-border/60 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-foreground">{owner.name}</span>
                            {getConfidenceBadge(owner.confidence)}
                          </div>
                          {(owner.guardian_name || owner.relation) && (
                            <p className="text-xs text-muted-foreground">
                              {owner.relation || 'Relation'}: <span className="text-foreground font-medium">{owner.guardian_name}</span>
                            </p>
                          )}
                          {owner.raw && (
                            <p className="text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                              Matched text: &ldquo;{owner.raw}&rdquo;
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-muted/20 border border-dashed border-border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">No statutory owner names extracted yet.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Parcel & Statutory Identifiers */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Hash className="w-4 h-4 text-foreground" />
                      Parcel & Record Identifiers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/40 border border-border/60 rounded-lg">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                          Survey / Khasra / Plot No
                        </span>
                        <span className="font-semibold text-sm text-foreground">
                          {extracted.survey_number?.value || document.parcel_identifier || '—'}
                        </span>
                        {getConfidenceBadge(extracted.survey_number?.confidence)}
                      </div>

                      <div className="p-3 bg-muted/40 border border-border/60 rounded-lg">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                          Khata / Patta / RoR No
                        </span>
                        <span className="font-semibold text-sm text-foreground">
                          {extracted.khata_number?.value || '—'}
                        </span>
                        {getConfidenceBadge(extracted.khata_number?.confidence)}
                      </div>
                    </div>

                    <div className="p-3 bg-muted/40 border border-border/60 rounded-lg space-y-1">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                        Land Extent / Total Area
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">
                          {extracted.area_extent?.value ? `${extracted.area_extent.value} ${extracted.area_extent.unit || 'sq. units'}` : '—'}
                        </span>
                        {extracted.area_extent?.sq_meters && (
                          <span className="text-xs font-mono text-muted-foreground">
                            ≈ {extracted.area_extent.sq_meters.toLocaleString()} m²
                          </span>
                        )}
                      </div>
                      {extracted.area_extent?.raw && (
                        <p className="text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                          Raw: {extracted.area_extent.raw}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Jurisdictional & Geographic Details */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-foreground" />
                      Jurisdiction & Revenue Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Village / Taluk</span>
                        <span className="font-medium text-foreground">
                          {extracted.location?.village || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">District</span>
                        <span className="font-medium text-foreground">
                          {extracted.location?.district || document.district || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md text-xs">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block">State / Union Territory</span>
                      <span className="font-medium text-foreground">
                        {extracted.location?.state || document.state || '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 4. Statutory Dates & Registration */}
                <Card className="border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-foreground" />
                      Registration & Deed Timestamps
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Deed / Reg. Date</span>
                        <span className="font-medium text-foreground">
                          {extracted.registration_date?.value || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Certificate Issue Date</span>
                        <span className="font-medium text-foreground">
                          {extracted.issue_date?.value || new Date(document.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-muted/40 border border-border/60 rounded-md text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">Extraction Engine:</span>
                      <span className="font-mono text-foreground">{extracted.extraction_engine || 'LRDS Indic-NLP v1'}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENT SCAN & OPENCV PREVIEW */}
          {activeTab === 'scan' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">View Mode:</span>
                  <Button
                    variant={!showProcessed ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowProcessed(false)}
                  >
                    Original Upload
                  </Button>
                  <Button
                    variant={showProcessed ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowProcessed(true)}
                  >
                    OpenCV Preprocessed (Deskewed/CLAHE)
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  >
                    -
                  </Button>
                  <span className="text-xs font-mono text-muted-foreground px-1">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  >
                    +
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setZoom(1)}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-xl bg-muted/10 p-4 min-h-[500px] flex items-center justify-center overflow-auto">
                {isPdf ? (
                  <iframe
                    src={showProcessed ? processedUrl : originalUrl}
                    className="w-full h-[600px] rounded-lg border border-border"
                    title="Document PDF Viewer"
                  />
                ) : (
                  <img
                    src={showProcessed ? processedUrl : originalUrl}
                    alt={document.title}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                    className="max-h-[600px] object-contain rounded-lg shadow-md transition-transform duration-100"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OCR RAW TEXT & SCRIPT ANALYSIS */}
          {activeTab === 'ocr' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Extracted Multilingual Text & Script Metadata
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Direct raw output from Tesseract / Indic-HTR model with Unicode normalization.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleCopyText}
                  disabled={!document.raw_text}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Raw Text
                    </>
                  )}
                </Button>
              </div>

              {document.raw_text ? (
                <div className="p-4 bg-muted/30 border border-border rounded-xl font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto select-text">
                  {document.raw_text}
                </div>
              ) : (
                <div className="p-12 text-center border border-dashed border-border rounded-xl">
                  <Languages className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No OCR text extracted yet. Run the pipeline on this document to extract raw text.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
