/**
 * Drives POST /api/news/upload-image over real HTTP.
 *
 * The route never reaches MongoDB - it is guard, multer, the file validators
 * and LocalStorageService - so the whole of it can be exercised without a
 * database. Everything here is the production code path except NewsService,
 * which is reduced to the one method this route calls.
 */
import 'reflect-metadata';
import { Module, Injectable } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NewsController } from '../src/news/news.controller';
import { NewsService } from '../src/news/news.service';
import { StorageModule } from '../src/storage/storage.module';
import { LocalStorageService } from '../src/storage/local-storage.service';
import { UPLOAD_ROOT } from '../src/storage/storage.constants';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';

const SECRET = 'upload-route-check-secret';
const PORT = 5099;

@Injectable()
class NewsServiceStub {
  constructor(private readonly storage: LocalStorageService) {}

  async uploadCoverImage(file: Express.Multer.File | undefined) {
    const stored = await this.storage.saveImage(file!, 'news');
    return { success: true, data: { url: stored.secureUrl, publicId: stored.publicId } };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    JwtModule.register({ global: true, secret: SECRET }),
    StorageModule,
  ],
  controllers: [NewsController],
  providers: [{ provide: NewsService, useClass: NewsServiceStub }],
})
class UploadCheckModule {}

async function main() {
  const app = await NestFactory.create(UploadCheckModule, { logger: false });
  await app.listen(PORT);

  const token = app.get(JwtService).sign({ id: 'test', role: 'admin' });
  const base = `http://127.0.0.1:${PORT}`;
  let failures = 0;
  const check = (label: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` - ${detail}` : ''}`);
    if (!ok) failures++;
  };

  const post = async (bytes: Buffer, filename: string, type: string, auth = true) => {
    const body = new FormData();
    body.append('image', new Blob([new Uint8Array(bytes)], { type }), filename);
    const response = await fetch(`${base}/api/news/upload-image`, {
      method: 'POST',
      headers: auth ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    return { status: response.status, json: await response.json().catch(() => null) };
  };

  // A 4000x3000 JPEG, the shape of a phone photo.
  const photo = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: '#31628f' },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  const uploaded = await post(photo, 'DSC_0001.JPG', 'image/jpeg');
  check('upload returns 201', uploaded.status === 201, `got ${uploaded.status}`);

  const url: string | undefined = uploaded.json?.data?.url ?? uploaded.json?.data?.data?.url;
  const publicId: string | undefined =
    uploaded.json?.data?.publicId ?? uploaded.json?.data?.data?.publicId;
  check('response carries a URL', Boolean(url), url ?? JSON.stringify(uploaded.json));
  check('stored as .avif', Boolean(url?.endsWith('.avif')), url ?? '');

  if (publicId) {
    const onDisk = path.join(UPLOAD_ROOT, publicId);
    const meta = await sharp(onDisk).metadata();
    check(
      'file on disk is 1600px and metadata-free',
      meta.width === 1600 && !meta.exif,
      `${meta.width}x${meta.height}`,
    );

    // Serving is bootstrap's job (useStaticAssets in main.ts), which this
    // harness does not run - those headers are checked against the deployed
    // host instead.
    check(
      'URL points at the upload prefix',
      url!.includes('/public/uploads/'),
      url!,
    );
  }

  const noAuth = await post(photo, 'x.jpg', 'image/jpeg', false);
  check('rejects an unauthenticated upload', noAuth.status === 401, `got ${noAuth.status}`);

  const wrongType = await post(Buffer.from('%PDF-1.4'), 'notes.pdf', 'application/pdf');
  check('rejects a PDF sent as an image', wrongType.status === 422 || wrongType.status === 400,
    `got ${wrongType.status}`);

  const liar = await post(Buffer.from('definitely not an image'), 'evil.png', 'image/png');
  check('rejects a renamed non-image', liar.status === 400, `got ${liar.status}`);

  const oversized = Buffer.alloc(11 * 1024 * 1024, 1);
  const tooBig = await post(oversized, 'huge.jpg', 'image/jpeg');
  check('rejects an 11MB file', tooBig.status >= 400, `got ${tooBig.status}`);

  await app.close();
  await fs.rm(UPLOAD_ROOT, { recursive: true, force: true });

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
