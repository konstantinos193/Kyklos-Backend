import * as path from 'path';

export const ARCHIVE_UPLOAD_DIR = path.join(process.cwd(), 'public', 'panhellenic-archive');

export const ARCHIVE_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const ARCHIVE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const ARCHIVE_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
] as const;

export const ARCHIVE_UNSUPPORTED_TYPE_MESSAGE =
  'Μη υποστηριζόμενος τύπος αρχείου. Επιτρέπονται: PDF, PNG, JPG, GIF, DOC, DOCX, XLS, XLSX, PPT, PPTX';

export const ARCHIVE_TOO_LARGE_MESSAGE = 'Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 50MB';

/**
 * A file is accepted only when BOTH the mime type and the extension are whitelisted,
 * so a renamed executable cannot ride in on a permissive mime type.
 */
export function isAllowedArchiveFile(mimeType: string, originalName: string): boolean {
  const mimeOk = (ARCHIVE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
  const ext = path.extname(originalName || '').toLowerCase();
  const extOk = (ARCHIVE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
  return mimeOk && extOk;
}
