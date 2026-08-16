import 'reflect-metadata';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalStorageService } from '../src/storage/local-storage.service';
import { UPLOAD_ROOT } from '../src/storage/storage.constants';

const config = { get: (key: string) => (key === 'PUBLIC_ASSET_BASE_URL' ? 'https://api.kyklosedu.gr' : undefined) } as any;
const service = new LocalStorageService(config);

const asMulter = (buffer: Buffer, mimetype: string, originalname: string): any => ({
  buffer,
  mimetype,
  originalname,
  size: buffer.length,
});

async function main() {
  // A "photograph": noisy 4000x3000 so the resize and AVIF path both matter.
  const photo = await sharp({
    create: { width: 4000, height: 3000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
  })
    .jpeg({ quality: 92 })
    .withMetadata({ exif: { IFD0: { Copyright: 'test', Artist: 'somebody' } } })
    .toBuffer();

  const storedPhoto = await service.saveImage(asMulter(photo, 'image/jpeg', 'DSC_9281.JPG'), 'news');
  console.log('photo in :', Math.round(photo.length / 1024), 'KB jpeg 4000x3000');
  console.log('photo out:', storedPhoto);

  const onDisk = path.join(UPLOAD_ROOT, storedPhoto.publicId);
  const meta = await sharp(onDisk).metadata();
  console.log('on disk  :', meta.format, meta.width + 'x' + meta.height, 'exif:', Boolean(meta.exif));

  // A "screenshot": PNG with transparency must stay WebP, not become AVIF.
  const graphic = await sharp({
    create: { width: 800, height: 600, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
  const storedGraphic = await service.saveImage(asMulter(graphic, 'image/png', 'screenshot.png'), 'news');
  console.log('graphic  :', storedGraphic.mimeType, storedGraphic.publicId);

  // Same bytes twice: content addressing must land on the same path.
  const again = await service.saveImage(asMulter(photo, 'image/jpeg', 'copy.JPG'), 'news');
  console.log('dedupe   :', again.publicId === storedPhoto.publicId ? 'same path' : 'DIFFERENT PATH');

  // A small image must not be blown up to 1600.
  const small = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#123456' } })
    .jpeg()
    .toBuffer();
  const storedSmall = await service.saveImage(asMulter(small, 'image/jpeg', 'small.jpg'), 'news');
  console.log('small    :', storedSmall.width + 'x' + storedSmall.height);

  // Raw files keep their bytes.
  const pdf = Buffer.from('%PDF-1.4 pretend');
  const storedPdf = await service.saveRawFile(asMulter(pdf, 'application/pdf', 'Θέματα 2024.pdf'), 'news-attachments');
  console.log('pdf      :', storedPdf.publicId, (await fs.readFile(path.join(UPLOAD_ROOT, storedPdf.publicId))).equals(pdf) ? 'bytes intact' : 'CORRUPT');

  // Junk must be rejected as a bad request rather than crashing the encoder.
  try {
    await service.saveImage(asMulter(Buffer.from('this is not an image'), 'image/png', 'evil.png'), 'news');
    console.log('junk     : NOT REJECTED');
  } catch (error: any) {
    console.log('junk     : rejected ->', error?.message);
  }

  // Traversal attempts must not touch anything outside the upload root.
  await service.delete('../../../package.json');
  console.log('traversal: package.json still here ->', await fs
    .access(path.join(process.cwd(), 'package.json'))
    .then(() => true)
    .catch(() => false));

  // Cleanup: the smoke test must not leave files in the repo.
  await service.delete(storedPhoto.publicId);
  await service.delete(storedGraphic.publicId);
  await service.delete(storedSmall.publicId);
  await service.delete(storedPdf.publicId);
  await fs.rm(UPLOAD_ROOT, { recursive: true, force: true });
  console.log('cleanup  : upload root removed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
