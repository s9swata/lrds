export interface LandOwner {
  name: string;
  relation?: string;
  guardian_name?: string | null;
  raw?: string | null;
  confidence?: number;
}

export interface LandArea {
  raw?: string | null;
  value?: number | null;
  unit?: string | null;
  sq_meters?: number | null;
  confidence?: number;
}

export interface LandLocation {
  village?: string | null;
  district?: string | null;
  state?: string | null;
}

export interface LandIdentifier {
  value?: string | null;
  raw?: string | null;
  confidence?: number;
}

export interface LandRecordCertificate {
  owners?: LandOwner[];
  survey_number?: LandIdentifier | null;
  khata_number?: LandIdentifier | null;
  area_extent?: LandArea | null;
  registration_date?: LandIdentifier | null;
  issue_date?: LandIdentifier | null;
  location?: LandLocation | null;
  document_type?: string;
  detected_language?: string;
  detected_script?: string;
  overall_confidence?: number;
  verification_status?: 'VERIFIED' | 'NEEDS_REVIEW' | string;
  extraction_engine?: string;
}

export interface LandDocument {
  id: number;
  title: string;
  original_filename: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type: string;
  parcel_identifier: string | null;
  district: string | null;
  state: string | null;
  status: 'PENDING' | 'PROCESSING' | 'DIGITIZED' | 'FAILED' | string;
  processed_file_path: string | null;
  detected_language: string | null;
  detected_script: string | null;
  raw_text: string | null;
  ocr_confidence: number | null;
  extracted_data: LandRecordCertificate | null;
  created_at: string;
  updated_at: string;
}

export interface UploadDocumentParams {
  file: File;
  title?: string;
  document_type?: string;
  parcel_identifier?: string;
  district?: string;
  state?: string;
}

const API_BASE = '/api';

export async function fetchDocuments(params?: {
  search?: string;
  document_type?: string;
  status?: string;
}): Promise<LandDocument[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.document_type && params.document_type !== 'ALL') {
    query.append('document_type', params.document_type);
  }
  if (params?.status && params.status !== 'ALL') {
    query.append('status', params.status);
  }

  const res = await fetch(`${API_BASE}/documents/?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch documents' }));
    throw new Error(err.detail || 'Failed to fetch documents');
  }
  return res.json();
}

export async function uploadDocument(params: UploadDocumentParams): Promise<LandDocument> {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.title) formData.append('title', params.title);
  if (params.document_type) formData.append('document_type', params.document_type);
  if (params.parcel_identifier) formData.append('parcel_identifier', params.parcel_identifier);
  if (params.district) formData.append('district', params.district);
  if (params.state) formData.append('state', params.state);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function deleteDocument(id: number): Promise<{ message: string; id: number }> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete document' }));
    throw new Error(err.detail || 'Failed to delete document');
  }
  return res.json();
}

export async function updateDocument(
  id: number,
  data: Partial<Pick<LandDocument, 'title' | 'document_type' | 'parcel_identifier' | 'district' | 'state' | 'status'>>
): Promise<LandDocument> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update document' }));
    throw new Error(err.detail || 'Failed to update document');
  }
  return res.json();
}

export async function processDocument(id: number): Promise<LandDocument> {
  const res = await fetch(`${API_BASE}/documents/${id}/process`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to process document' }));
    throw new Error(err.detail || 'Failed to process document');
  }
  return res.json();
}

export function getDocumentFileUrl(id: number, download = false, processed = false): string {
  const params = new URLSearchParams();
  if (download) params.append('download', 'true');
  if (processed) params.append('processed', 'true');
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return `${API_BASE}/documents/${id}/file${queryStr}`;
}
