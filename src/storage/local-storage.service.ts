import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  AVIF_OPTIONS,
  IMAGE_MAX_DIMENSION,
  IMAGE_PROCESSING_FAILED_MESSAGE,
  UNSUPPORTED_IMAGE_MESSAGE,
  UPLOAD_ROOT,
  UPLOAD_URL_PREFIX,
  WEBP_ANIMATED_OPTIONS,
  WEBP_OPTIONS,
  isConvertibleImage,
} from './storage.constants';

export interface StoredFile {
  /** Absolute URL when a public base is configured, otherwise the path. */
  url: string;
  /** Same value as `url`; kept so call sites read the same as they did before. */
  secureUrl: string;
  /** Path relative to the upload root. The handle used to delete the file. */
  publicId: string;
  bytes: number;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * libvips is fast, but it is fast per core. Two administrators saving posts at
 * once should not each get half a vCPU on a 2GB host, so encodes are serialised
 * and every other request keeps its share.
 */
sharp.concurrency(1);

@Injectable()
export class LocalStorageService implements OnModuleInit {
  private readonly logger = new Logger(LocalStorageService.name);

  /** Tail of the encode queue. Awaiting it serialises the next job behind it. */
  private encodeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Proves at boot that uploads can be written.
   *
   * public/ is a Docker volume, owned by whoever created it. If that is root
   * and this process is not, every upload fails with EACCES - at the moment an
   * administrator presses save, not at the moment the container started. This
   * puts it in the startup log instead, where it is findable.
   */
  async onModuleInit(): Promise<void> {
    if (await this.healthCheck()) {
      this.logger.log(`Upload root ready: ${UPLOAD_ROOT}`);
    } else {
      this.logger.error(
        `Upload root is not writable: ${UPLOAD_ROOT}. Uploads will fail until it is.`,
      );
    }
  }

  /**
   * Where the browser reaches a stored file.
   *
   * The admin panel and the public site run on a different origin to this API,
   * so a bare `/public/...` would resolve against the wrong host. The base is
   * configuration rather than a guess from the request: URLs are written into
   * MongoDB and outlive the request that produced them.
   */
  private publicUrl(relativePath: string): string {
    const base = (
      this.configService.get<string>('PUBLIC_ASSET_BASE_URL') ||
      this.configService.get<string>('API_PUBLIC_URL') ||
      ''
    ).replace(/\/+$/, '');

    const url = `${UPLOAD_URL_PREFIX}/${relativePath}`;
    return base ? `${base}${url}` : url;
  }

  /**
   * Content-addressed layout: `news/0a/91/0a91f8….avif`.
   *
   * Two levels of fan-out keep any one directory small enough that `ls` and
   * `unlink` stay cheap once the archive is tens of thousands of files, and
   * naming by digest means re-uploading the same photo costs nothing and the
   * URL can be cached forever.
   */
  private async write(folder: string, buffer: Buffer, extension: string): Promise<string> {
    const digest = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const relativePath = path.posix.join(
      folder,
      digest.slice(0, 2),
      digest.slice(2, 4),
      `${digest}.${extension}`,
    );

    const absolutePath = path.join(UPLOAD_ROOT, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // `wx` fails when the file exists, which for a digest name means the exact
    // same bytes are already on disk - nothing to do, and no torn rewrite of a
    // file another request may be serving.
    try {
      await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
    }

    return relativePath;
  }

  /** Runs `job` with every other encode, so only one runs at a time. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.encodeQueue.then(job, job);
    // The queue must not inherit a rejection, or one bad upload poisons the rest.
    this.encodeQueue = result.catch(() => undefined);
    return result;
  }

  /**
   * Resizes, strips metadata and re-encodes an uploaded image, then stores it.
   *
   * Photographs become AVIF, which is the smallest of the formats every browser
   * we support can decode. Screenshots, logos and anything with transparency
   * become WebP instead: AVIF's chroma compression blurs small text and hard
   * edges, and a smeared screenshot is not a saving.
   */
  async saveImage(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Δεν επιλέχθηκε αρχείο εικόνας');
    }
    if (!isConvertibleImage(file.mimetype)) {
      throw new BadRequestException(UNSUPPORTED_IMAGE_MESSAGE);
    }

    return this.enqueue(async () => {
      let metadata: sharp.Metadata;
      try {
        metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
      } catch (error: any) {
        this.logger.warn(`Rejected unreadable image: ${error?.message ?? error}`);
        throw new BadRequestException(UNSUPPORTED_IMAGE_MESSAGE);
      }

      const isAnimated = (metadata.pages ?? 1) > 1;
      // Transparency and flat graphics survive WebP intact; photographs do not
      // need it and compress better as AVIF.
      const keepsAlpha = Boolean(metadata.hasAlpha);
      const isGraphic = keepsAlpha || metadata.format === 'png' || metadata.format === 'svg';

      const pipeline = sharp(file.buffer, { animated: isAnimated, failOn: 'error' })
        // Phone photos carry their orientation in EXIF, and EXIF is about to be
        // stripped. Baking the rotation in first keeps them upright.
        .rotate()
        .resize({
          width: IMAGE_MAX_DIMENSION,
          // An animated source is one tall strip of frames; constraining its
          // height would squash every frame.
          height: isAnimated ? undefined : IMAGE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        });

      // The format is taken from the branch, not from what sharp reports back:
      // AVIF is a HEIF container, so `info.format` on an AVIF output is "heif".
      // Trusting it wrote every photo out as `.heif`, which browsers will not
      // display.
      const format: 'avif' | 'webp' = isAnimated || isGraphic ? 'webp' : 'avif';

      const encoded = isAnimated
        ? pipeline.webp(WEBP_ANIMATED_OPTIONS)
        : isGraphic
          ? pipeline.webp(WEBP_OPTIONS)
          : pipeline.avif(AVIF_OPTIONS);

      let buffer: Buffer;
      let info: sharp.OutputInfo;
      try {
        // Metadata is dropped by default on a new output: no GPS coordinates
        // from the photographer's phone, no camera serial, no 40KB colour profile.
        ({ data: buffer, info } = await encoded.toBuffer({ resolveWithObject: true }));
      } catch (error: any) {
        this.logger.error(`Image encode failed: ${error?.message ?? error}`);
        throw new BadRequestException(IMAGE_PROCESSING_FAILED_MESSAGE);
      }

      const relativePath = await this.write(folder, buffer, format);

      this.logger.log(
        `Stored ${relativePath} (${Math.round(file.size / 1024)}KB ${metadata.format} → ` +
          `${Math.round(buffer.length / 1024)}KB ${format}, ${info.width}x${info.height})`,
      );

      const url = this.publicUrl(relativePath);
      return {
        url,
        secureUrl: url,
        publicId: relativePath,
        bytes: buffer.length,
        mimeType: `image/${format}`,
        width: info.width,
        height: info.height,
      };
    });
  }

  /**
   * Stores a file byte for byte.
   *
   * Attachments and exercise material are downloaded, not rendered - a PDF the
   * teacher uploaded has to come back out as the same PDF, so nothing here
   * re-encodes anything.
   */
  async saveRawFile(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Το αρχείο είναι κενό');
    }

    // Extension comes from the uploaded name, but only ever as a short
    // alphanumeric tail - the stored name is a digest, so nothing of the
    // original path or its dots reaches the filesystem.
    const rawExtension = path.extname(file.originalname || '').replace(/^\./, '').toLowerCase();
    const extension = /^[a-z0-9]{1,8}$/.test(rawExtension) ? rawExtension : 'bin';

    const relativePath = await this.write(folder, file.buffer, extension);
    const url = this.publicUrl(relativePath);

    return {
      url,
      secureUrl: url,
      publicId: relativePath,
      bytes: file.size ?? file.buffer.length,
      mimeType: file.mimetype,
    };
  }

  /** Images are converted, everything else is kept as uploaded. */
  async saveFile(file: Express.Multer.File, folder: string): Promise<StoredFile> {
    return isConvertibleImage(file.mimetype)
      ? this.saveImage(file, folder)
      : this.saveRawFile(file, folder);
  }

  /**
   * Removes a stored file.
   *
   * Never throws: a delete that fails leaves an orphan on disk, which is a
   * cleanup job, while a delete that throws leaves the record it belonged to
   * undeletable. Anything that does not resolve inside the upload root - a
   * traversal attempt, or a leftover Cloudinary public id from before the
   * migration - is ignored rather than acted on.
   */
  async delete(publicId: string): Promise<void> {
    if (!publicId) return;

    const absolutePath = path.resolve(UPLOAD_ROOT, publicId);
    if (!absolutePath.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
      this.logger.warn(`Refused to delete outside the upload root: ${publicId}`);
      return;
    }

    try {
      await fs.unlink(absolutePath);
      this.logger.log(`Deleted ${publicId}`);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        this.logger.error(`Failed to delete ${publicId}: ${error?.message ?? error}`);
      }
    }
  }

  /** Disk is local, so the only way this fails is a broken mount. */
  async healthCheck(): Promise<boolean> {
    try {
      await fs.mkdir(UPLOAD_ROOT, { recursive: true });
      await fs.access(UPLOAD_ROOT);
      return true;
    } catch (error: any) {
      this.logger.error(`Upload root unavailable: ${error?.message ?? error}`);
      return false;
    }
  }
}
