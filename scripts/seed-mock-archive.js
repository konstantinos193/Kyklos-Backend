/**
 * Seeds the panhellenic archive with mock papers so the archive page can be
 * eyeballed with a realistic amount of content.
 *
 * One file per subject per year, which is the shape the real archive has.
 * Every document is stamped `isMock: true` and every file name is prefixed
 * `mock-`, so `--clean` can remove the whole set without touching real uploads.
 *
 *   node scripts/seed-mock-archive.js          # write files + documents
 *   node scripts/seed-mock-archive.js --clean  # remove them again
 *
 * Reads Kyklos-Backend/.env (the dev database) on purpose - NOT the repo-root
 * production.env that the other seed scripts default to. Writing mock rows into
 * the production Atlas cluster is refused unless --force is passed.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');

const COLLECTION = 'panhellenicarchive';
const UPLOAD_DIR = path.resolve(__dirname, '..', 'public', 'panhellenic-archive');

/** Greek label per subject, matching lib/panhellenic-subjects.ts on the frontend. */
const SUBJECTS = [
  { slug: 'math', label: 'Μαθηματικά', latin: 'MATHIMATIKA' },
  { slug: 'algebra', label: 'Άλγεβρα', latin: 'ALGEVRA' },
  { slug: 'geometry', label: 'Γεωμετρία', latin: 'GEOMETRIA' },
  { slug: 'physics', label: 'Φυσική', latin: 'FYSIKI' },
  { slug: 'ximia', label: 'Χημεία', latin: 'CHIMEIA' },
  { slug: 'biology', label: 'Βιολογία', latin: 'VIOLOGIA' },
  { slug: 'greek-literature', label: 'Έκθεση - Λογοτεχνία', latin: 'EKTHESI - LOGOTECHNIA' },
  { slug: 'ancient-greek', label: 'Αρχαία', latin: 'ARCHAIA' },
  { slug: 'history', label: 'Ιστορία', latin: 'ISTORIA' },
  { slug: 'latin', label: 'Λατινικά', latin: 'LATINIKA' },
  { slug: 'economics', label: 'ΑΟΘ / Οικονομικά', latin: 'AOTH / OIKONOMIKA' },
  { slug: 'informatics', label: 'Πληροφορική', latin: 'PLIROFORIKI' },
];

/**
 * 12 subjects over 2014-2025 is 144. The remaining 6 go to 2013, covering only
 * the core subjects - that keeps the total at exactly 150 while still giving
 * the page one sparse year to render, instead of a perfectly square grid.
 */
const FULL_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
const SPARSE_YEAR = 2013;
const SPARSE_SUBJECTS = ['math', 'physics', 'ximia', 'biology', 'greek-literature', 'ancient-greek'];

function buildPairs() {
  const pairs = [];
  for (const subject of SUBJECTS) {
    for (const year of FULL_YEARS) {
      pairs.push({ subject, year });
    }
  }
  for (const slug of SPARSE_SUBJECTS) {
    pairs.push({ subject: SUBJECTS.find((s) => s.slug === slug), year: SPARSE_YEAR });
  }
  return pairs;
}

/** Stable per-file pseudo-random number, so re-running produces identical files. */
function seededInt(key, min, max) {
  const digest = crypto.createHash('sha1').update(key).digest();
  return min + (digest.readUInt32BE(0) % (max - min));
}

/**
 * Writes a real, openable one-page PDF. The archive card shows a preview and a
 * file size, so a zero-byte placeholder would not exercise either. Text is
 * transliterated because the base-14 Helvetica used here is WinAnsi-encoded and
 * has no Greek glyphs - the Greek names live in the database record, which is
 * what the page actually renders.
 */
function buildPdf(lines, padBytes) {
  const escape = (text) => text.replace(/([\\()])/g, '\\$1');

  let content = 'BT\n';
  content += '/F1 22 Tf\n';
  content += `1 0 0 1 60 760 Tm\n(${escape(lines[0])}) Tj\n`;
  content += '/F1 14 Tf\n';
  for (let i = 1; i < lines.length; i++) {
    content += `1 0 0 1 60 ${710 - (i - 1) * 26} Tm\n(${escape(lines[i])}) Tj\n`;
  }
  content += 'ET\n';

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>',
    `<</Length ${Buffer.byteLength(content, 'latin1')}>>\nstream\n${content}\nendstream`,
  ];

  // Unreferenced filler stream. Padding here rather than after %%EOF keeps the
  // file structurally valid while still varying the on-disk size per document.
  if (padBytes > 0) {
    objects.push(`<</Length ${padBytes}>>\nstream\n${'0'.repeat(padBytes)}\nendstream`);
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

function assertSafeTarget(uri, force) {
  const isAtlas = uri.startsWith('mongodb+srv://');
  if (isAtlas && !force) {
    throw new Error(
      'MONGODB_URI points at a mongodb+srv cluster, which is the production target.\n' +
        '   Refusing to seed mock data. Pass --force if this really is what you want.'
    );
  }
}

async function main() {
  const clean = process.argv.includes('--clean');
  const force = process.argv.includes('--force');

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';
  if (!uri) throw new Error('MONGODB_URI is not set in Kyklos-Backend/.env');

  assertSafeTarget(uri, force);
  console.log(`🎯 Target: ${uri.replace(/\/\/[^@]+@/, '//***@')} → ${dbName}.${COLLECTION}`);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();

  try {
    const collection = client.db(dbName).collection(COLLECTION);

    if (clean) {
      const result = await collection.deleteMany({ isMock: true });
      let removed = 0;
      if (fs.existsSync(UPLOAD_DIR)) {
        for (const name of fs.readdirSync(UPLOAD_DIR)) {
          if (!name.startsWith('mock-')) continue;
          fs.unlinkSync(path.join(UPLOAD_DIR, name));
          removed++;
        }
      }
      console.log(`🧹 Removed ${result.deletedCount} documents and ${removed} files.`);
      return;
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const pairs = buildPairs();
    const now = new Date();
    const documents = [];

    for (const { subject, year } of pairs) {
      const publicId = `mock-${subject.slug}-${year}.pdf`;
      const padBytes = seededInt(publicId, 12000, 202000);

      const pdf = buildPdf(
        [
          'KYKLOS EDU - MOCK ARCHIVE',
          `${subject.latin} ${year}`,
          'Themata Panelladikon Exetaseon',
          '',
          'Placeholder document generated by',
          'scripts/seed-mock-archive.js.',
          'Not real exam content.',
        ],
        padBytes
      );

      fs.writeFileSync(path.join(UPLOAD_DIR, publicId), pdf);

      documents.push({
        displayName: `${subject.label} — Θέματα ${year}`,
        fileName: `${subject.slug}_${year}.pdf`,
        subject: subject.slug,
        year,
        description: `Θέματα πανελλαδικών εξετάσεων ${year} (mock).`,
        url: `/public/panhellenic-archive/${publicId}`,
        fileUrl: `/public/panhellenic-archive/${publicId}`,
        publicId,
        mimeType: 'application/pdf',
        fileSize: pdf.length,
        uploadedBy: null,
        uploadedByName: 'Mock Seeder',
        isActive: true,
        isMock: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Re-runnable: drop the previous mock set rather than stacking duplicates.
    const cleared = await collection.deleteMany({ isMock: true });
    if (cleared.deletedCount) {
      console.log(`♻️  Replaced ${cleared.deletedCount} existing mock documents.`);
    }

    const result = await collection.insertMany(documents);
    const bytes = documents.reduce((sum, doc) => sum + doc.fileSize, 0);

    console.log(
      `✅ Inserted ${result.insertedCount} mock files ` +
        `(${SUBJECTS.length} subjects × ${FULL_YEARS.length} years + ${SPARSE_SUBJECTS.length} for ${SPARSE_YEAR}), ` +
        `${(bytes / 1024 / 1024).toFixed(1)} MB on disk.`
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
