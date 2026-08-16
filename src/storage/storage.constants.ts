import * as path from 'path';

/**
 * Everything uploaded through the admin panel now lands on this host's disk
 * instead of Cloudinary. `public/` is already mounted as a named Docker volume
 * (`public-files:/app/public`) and already served by `useStaticAssets` under
 * `/public/`, so files written here survive a blue/green deploy and are
 * reachable without any further plumbing.
 */
export const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

/** The URL prefix `UPLOAD_ROOT` is exposed under. Must match main.ts. */
export const UPLOAD_URL_PREFIX = '/public/uploads';

/**
 * Long side cap for displayed images. Nothing on the site renders wider than
 * ~1200 CSS pixels, so 1600 covers a 2x hero and still throws away the 20
 * megapixels a phone camera insists on attaching.
 */
export const IMAGE_MAX_DIMENSION = 1600;

/**
 * AVIF for photographs. Quality 58 is visually indistinguishable at these
 * sizes; effort 2 keeps the encode near a second on a shared vCPU instead of
 * pinning a core for half a minute to save a few kilobytes.
 */
export const AVIF_OPTIONS = {
  quality: 58,
  effort: 2,
  chromaSubsampling: '4:4:4',
  bitdepth: 8,
} as const;

/**
 * WebP for screenshots, logos and anything with transparency. AVIF's chroma
 * handling smears small text and hard UI edges, which is most of what gets
 * pasted into an announcement.
 */
export const WEBP_OPTIONS = {
  quality: 85,
  effort: 4,
} as const;

/** Animated sources keep their frames; AVIF animation support is not worth it. */
export const WEBP_ANIMATED_OPTIONS = {
  quality: 80,
  effort: 4,
} as const;

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
] as const;

export function isConvertibleImage(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const UNSUPPORTED_IMAGE_MESSAGE =
  'Μη υποστηριζόμενος τύπος εικόνας. Επιτρέπονται: PNG, JPG, GIF, WEBP, AVIF.';

export const IMAGE_PROCESSING_FAILED_MESSAGE =
  'Η επεξεργασία της εικόνας απέτυχε. Δοκιμάστε άλλο αρχείο.';
