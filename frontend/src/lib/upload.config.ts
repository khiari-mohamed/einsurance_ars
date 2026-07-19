// src/lib/upload.config.ts
// NOTE: MAX_FILE_SIZE_MB must match server/.env's MAX_FILE_SIZE_MB.
// Frontend can't read backend env vars, so this is a manual mirror —
// if you change MAX_FILE_SIZE_MB in server/.env, update this too.
export const MAX_FILE_SIZE_MB = 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'WORD',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'WORD',
  'application/vnd.ms-excel': 'EXCEL',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'EXCEL',
  'text/csv': 'CSV',
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
};

export const ACCEPT_ATTRIBUTE = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg';

export function isAllowedFile(file: File): boolean {
  if (ALLOWED_MIME_TYPES[file.type]) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPT_ATTRIBUTE.split(',').includes(ext);
}