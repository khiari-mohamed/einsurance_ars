// src/config/upload.config.ts
import { extname } from 'path';

export const UPLOAD_CATEGORY = {
  PDF: 'PDF',
  WORD: 'WORD',
  EXCEL: 'EXCEL',
  CSV: 'CSV',
  IMAGE: 'IMAGE',
} as const;

export type UploadCategory = keyof typeof UPLOAD_CATEGORY;

export const ALLOWED_MIME_TYPES: Record<string, UploadCategory> = {
  'application/pdf': 'PDF',
  'application/msword': 'WORD',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'WORD',
  'application/vnd.ms-excel': 'EXCEL',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'EXCEL',
  'text/csv': 'CSV',
  'application/csv': 'CSV',
  'application/vnd.ms-excel.sheet.csv': 'CSV',
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/jpg': 'IMAGE',
  'image/tiff': 'IMAGE', // FIX: GED previously accepted scanned TIFFs; keep parity now that GED delegates here
};

export const ALLOWED_EXTENSIONS: Record<string, UploadCategory> = {
  '.pdf': 'PDF',
  '.doc': 'WORD',
  '.docx': 'WORD',
  '.xls': 'EXCEL',
  '.xlsx': 'EXCEL',
  '.csv': 'CSV',
  '.png': 'IMAGE',
  '.jpg': 'IMAGE',
  '.jpeg': 'IMAGE',
  '.tiff': 'IMAGE', // FIX: see above
  '.tif': 'IMAGE',  // FIX: see above
};

export const MAX_FILES_PER_BULK_UPLOAD = 20;

export function resolveCategory(mimetype: string, originalName: string): UploadCategory | null {
  if (ALLOWED_MIME_TYPES[mimetype]) return ALLOWED_MIME_TYPES[mimetype];
  const ext = extname(originalName).toLowerCase();
  if (ALLOWED_EXTENSIONS[ext]) return ALLOWED_EXTENSIONS[ext];
  return null;
}