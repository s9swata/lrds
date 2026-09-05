import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  X,
  MapPin,
  Tag,
  Hash,
  Loader2,
} from 'lucide-react';
import { uploadDocument, LandDocument } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';

const DOCUMENT_TYPES = [
  { value: 'title_deed', label: 'Title Deed / Ownership Certificate' },
  { value: 'sale_deed', label: 'Sale Deed / Conveyance Deed' },
  { value: 'khata', label: 'Khata / Patta / RoR (Record of Rights)' },
  { value: 'survey_map', label: 'Cadastral Survey Map / Plot Blueprint' },
  { value: 'mutation_record', label: 'Mutation Record / Transfer Register' },
  { value: 'tax_receipt', label: 'Land Revenue / Tax Assessment Receipt' },
  { value: 'encumbrance', label: 'Encumbrance Certificate (EC)' },
  { value: 'other', label: 'Other Land Document' },
];

interface DocumentUploadZoneProps {
  onUploadSuccess: (doc: LandDocument) => void;
}

export function DocumentUploadZone({ onUploadSuccess }: DocumentUploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('title_deed');
  const [parcelId, setParcelId] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setSuccess(false);

    // Validate size (50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 50MB.');
      return;
    }

    setFile(selectedFile);
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(nameWithoutExt);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setParcelId('');
    setDistrict('');
    setState('');
    setDocumentType('title_deed');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadedDoc = await uploadDocument({
        file,
        title: title.trim() || undefined,
        document_type: documentType,
        parcel_identifier: parcelId.trim() || undefined,
        district: district.trim() || undefined,
        state: state.trim() || undefined,
      });

      setSuccess(true);
      onUploadSuccess(uploadedDoc);
      resetForm();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="border border-border/80 shadow-xs dark:bg-card">
      <CardHeader className="pb-4 border-b border-border/60">
        <CardTitle className="text-base tracking-tight font-semibold flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-foreground" />
          Upload Land Record Document
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          Supports scanned deeds, revenue maps, patta/khata certificates (PDF, PNG, JPG, TIFF, WebP up to 50MB).
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dropzone Area */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border border-dashed rounded-lg p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
              isDragging
                ? 'border-foreground bg-accent/40 scale-[0.99]'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/10'
                : 'border-border hover:border-foreground/50 hover:bg-muted/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {file ? (
              <div className="flex items-center gap-3 w-full max-w-md p-2 rounded-md bg-background border border-border shadow-2xs">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                  {file.type.includes('pdf') ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-foreground truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Unknown format'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <UploadCloud className="w-5 h-5 text-foreground" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  <span className="font-semibold underline underline-offset-2">Click to upload</span> or drag and drop document scan
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PDF, PNG, JPEG, TIFF, or WebP (Max 50 MB)
                </p>
              </div>
            )}
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                Document Title
              </label>
              <Input
                type="text"
                placeholder="e.g. Patta Deed Plot 44/B"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                Document Category
              </label>
              <Select
                value={documentType}
                onValueChange={(val) => setDocumentType(val)}
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                Survey / Plot / Parcel ID
              </label>
              <Input
                type="text"
                placeholder="e.g. 104/2B, Khasra 492"
                value={parcelId}
                onChange={(e) => setParcelId(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  District
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Kanchipuram"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">State</label>
                <Input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={isUploading}
                />
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Document uploaded successfully! Background OCR & field extraction pipeline triggered.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              disabled={isUploading || (!file && !title && !parcelId)}
            >
              Reset
            </Button>
            <Button
              type="submit"
              variant="vercel"
              size="sm"
              disabled={isUploading || !file}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading & Queuing OCR...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload & Digitize
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
