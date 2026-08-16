/**
 * Seed των επιτυχόντων από το hardcoded frontend αρχείο στη MongoDB.
 *
 * Πηγή:    Kyklos-frontend/components/epityxontes/students-data.ts
 * Στόχος:  collection `epityxontes`
 *
 * Χρήση:
 *   node scripts/seed-epityxontes.js --dry-run          # parse + report, ΚΑΜΙΑ εγγραφή
 *   node scripts/seed-epityxontes.js                    # local .env, insert μόνο ετών που λείπουν
 *   node scripts/seed-epityxontes.js --force            # σβήνει & ξαναγράφει τα έτη που υπάρχουν
 *   node scripts/seed-epityxontes.js --env=../production.env   # live database
 *   node scripts/seed-epityxontes.js --uri=... --db=... # explicit override
 *   node scripts/seed-epityxontes.js --years=2024,2025  # μόνο συγκεκριμένα έτη
 */

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'epityxontes';
const SOURCE_FILE = path.resolve(
  __dirname,
  '../../Kyklos-frontend/components/epityxontes/students-data.ts',
);

// ---------------------------------------------------------------- CLI args

function parseArgs(argv) {
  const args = { dryRun: false, force: false, env: null, uri: null, db: null, years: null };

  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--env=')) args.env = arg.slice('--env='.length);
    else if (arg.startsWith('--uri=')) args.uri = arg.slice('--uri='.length);
    else if (arg.startsWith('--db=')) args.db = arg.slice('--db='.length);
    else if (arg.startsWith('--years=')) {
      args.years = arg
        .slice('--years='.length)
        .split(',')
        .map((y) => parseInt(y.trim(), 10))
        .filter((y) => Number.isInteger(y));
    } else {
      throw new Error(`Άγνωστο argument: ${arg}`);
    }
  }

  return args;
}

/** Κρύβει το password ώστε να μη διαρρεύσει σε logs/CI output. */
function maskUri(uri) {
  return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/, '$1***@');
}

// ------------------------------------------------------------- parse source

/**
 * Διαβάζει το students-data.ts και βγάζει { startYear, students[] }.
 *
 * Το αρχείο είναι μηχανικά ομοιόμορφο (κάθε εγγραφή σε μία γραμμή, single quotes,
 * χωρίς escapes), οπότε regex parsing είναι αρκετό - δεν χρειάζεται TS toolchain.
 * Αν αυτό αλλάξει, το verifyParse() παρακάτω το πιάνει και σκάει.
 */
function parseStudentsData(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Δεν βρέθηκε το αρχείο δεδομένων: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const blockRegex = /export const students(\d{4}):\s*Student\[\]\s*=\s*\[([\s\S]*?)\n\];/g;
  const entryRegex =
    /\{\s*lastName:\s*'([^']*)',\s*firstName:\s*'([^']*)',\s*schoolTitle:\s*'([^']*)'\s*\}/g;

  const years = [];
  let blockMatch;

  while ((blockMatch = blockRegex.exec(source)) !== null) {
    const startYear = parseInt(blockMatch[1], 10);
    const body = blockMatch[2];

    const students = [];
    let entryMatch;
    entryRegex.lastIndex = 0;

    while ((entryMatch = entryRegex.exec(body)) !== null) {
      students.push({
        lastName: entryMatch[1].trim(),
        firstName: entryMatch[2].trim(),
        schoolTitle: entryMatch[3].trim(),
      });
    }

    years.push({ startYear, students });
  }

  verifyParse(source, years);

  // Νεότερο έτος πρώτο - ίδια σειρά με το frontend.
  years.sort((a, b) => b.startYear - a.startYear);
  return years;
}

/** Το parse είναι regex-based: επιβεβαιώνει ότι δεν χάθηκε καμία εγγραφή σιωπηλά. */
function verifyParse(source, years) {
  // Το interface declaration στην κορυφή γράφει `lastName: string;` - δεν είναι εγγραφή.
  const expected = (source.match(/\{\s*lastName:\s*'/g) || []).length;
  const parsed = years.reduce((sum, y) => sum + y.students.length, 0);

  if (parsed !== expected) {
    throw new Error(
      `Parse mismatch: βρέθηκαν ${expected} εγγραφές στο αρχείο αλλά έγιναν parse ${parsed}. ` +
        'Άλλαξε η μορφή του students-data.ts - διόρθωσε το regex πριν το seed.',
    );
  }

  const emptyYears = years.filter((y) => y.students.length === 0);
  if (emptyYears.length > 0) {
    throw new Error(
      `Έτη χωρίς καμία εγγραφή: ${emptyYears.map((y) => y.startYear).join(', ')}`,
    );
  }
}

// --------------------------------------------------------------- documents

function buildDocuments(year, now) {
  const { startYear, students } = year;
  const endYear = startYear + 1;
  const slug = `epityxontes-etos-${startYear}-${endYear}`;

  return students.map((student, index) => ({
    lastName: student.lastName,
    firstName: student.firstName,
    schoolTitle: student.schoolTitle,
    startYear,
    endYear,
    slug,
    // Διατηρεί τη σειρά του αρχικού αρχείου - οι public σελίδες δεν αλλάζουν όψη.
    order: index,
    isActive: true,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Κενά πεδία στην πηγή. Στο 1992 υπάρχουν εγγραφές όπου το όνομα έχει κολλήσει
 * στην αρχή της σχολής και το firstName έμεινε κενό - ήδη ορατό λάθος στο site.
 */
function findIncomplete(years) {
  const incomplete = [];

  for (const { startYear, students } of years) {
    students.forEach((student, index) => {
      if (!student.lastName || !student.firstName || !student.schoolTitle) {
        incomplete.push({ startYear, order: index, ...student });
      }
    });
  }

  return incomplete;
}

/** Ίδιο πρόσωπο + ίδια σχολή + ίδιο έτος = πιθανό διπλό στα αρχικά δεδομένα. */
function findDuplicates(years) {
  const duplicates = [];

  for (const { startYear, students } of years) {
    const seen = new Map();

    for (const student of students) {
      const key = `${student.lastName}|${student.firstName}|${student.schoolTitle}`;
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);

      if (count === 2) {
        duplicates.push({ startYear, ...student });
      }
    }
  }

  return duplicates;
}

// -------------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);

  const envPath = path.resolve(__dirname, '..', args.env || '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`🔧 Env: ${envPath}`);
  } else if (args.env) {
    throw new Error(`Δεν βρέθηκε το env αρχείο: ${envPath}`);
  } else {
    console.log('🔧 Env: δεν βρέθηκε .env, χρήση μεταβλητών περιβάλλοντος');
  }

  const mongoUri = args.uri || process.env.MONGODB_URI;
  const dbName = args.db || process.env.MONGODB_DB_NAME;

  if (!mongoUri) throw new Error('Λείπει MONGODB_URI (ή δώσε --uri=...)');
  if (!dbName) throw new Error('Λείπει MONGODB_DB_NAME (ή δώσε --db=...)');

  console.log(`📖 Πηγή: ${SOURCE_FILE}`);
  let years = parseStudentsData(SOURCE_FILE);

  if (args.years) {
    const wanted = new Set(args.years);
    const missing = args.years.filter((y) => !years.some((entry) => entry.startYear === y));
    if (missing.length > 0) {
      throw new Error(`Τα έτη ${missing.join(', ')} δεν υπάρχουν στο αρχείο δεδομένων.`);
    }
    years = years.filter((entry) => wanted.has(entry.startYear));
  }

  const totalStudents = years.reduce((sum, y) => sum + y.students.length, 0);
  console.log(`✅ Parse: ${totalStudents} επιτυχόντες σε ${years.length} έτη`);
  console.log(`   Έτη: ${years.map((y) => y.startYear).join(', ')}`);

  const duplicates = findDuplicates(years);
  if (duplicates.length > 0) {
    console.log(`\n⚠️  ${duplicates.length} πιθανά διπλά (ίδιο όνομα + σχολή + έτος):`);
    for (const dup of duplicates) {
      console.log(`   ${dup.startYear}: ${dup.lastName} ${dup.firstName} — ${dup.schoolTitle}`);
    }
    console.log('   Μπαίνουν κανονικά - διόρθωσέ τα από το admin αν είναι λάθος.\n');
  }

  const incomplete = findIncomplete(years);
  if (incomplete.length > 0) {
    console.log(`\n⚠️  ${incomplete.length} εγγραφές με κενό πεδίο στην πηγή:`);
    for (const entry of incomplete) {
      console.log(
        `   ${entry.startYear} #${entry.order}: ` +
          `επώνυμο="${entry.lastName}" όνομα="${entry.firstName}" σχολή="${entry.schoolTitle}"`,
      );
    }
    console.log('   Μπαίνουν ως έχουν - διόρθωσέ τα από το admin.\n');
  }

  if (args.dryRun) {
    console.log('🔍 --dry-run: καμία εγγραφή στη βάση.');
    console.log(`   Θα γραφόταν: ${maskUri(mongoUri)} → ${dbName}.${COLLECTION_NAME}`);
    return;
  }

  console.log(`\n🔌 Σύνδεση: ${maskUri(mongoUri)} → ${dbName}.${COLLECTION_NAME}`);
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const collection = client.db(dbName).collection(COLLECTION_NAME);

    // Χωρίς index, το /epityxontes/[slug] κάνει full collection scan σε κάθε request.
    await collection.createIndex({ startYear: -1, order: 1 }, { name: 'year_order' });
    await collection.createIndex({ slug: 1 }, { name: 'slug' });
    await collection.createIndex({ lastName: 1, firstName: 1 }, { name: 'name' });
    console.log('📇 Indexes: OK');

    const now = new Date();
    let inserted = 0;
    let replaced = 0;
    let skipped = 0;

    for (const year of years) {
      const existing = await collection.countDocuments({ startYear: year.startYear });

      if (existing > 0 && !args.force) {
        console.log(
          `⏭️  ${year.startYear}: υπάρχουν ήδη ${existing} εγγραφές — skip (--force για αντικατάσταση)`,
        );
        skipped += year.students.length;
        continue;
      }

      if (existing > 0) {
        const { deletedCount } = await collection.deleteMany({ startYear: year.startYear });
        replaced += deletedCount;
        console.log(`🗑️  ${year.startYear}: διαγράφηκαν ${deletedCount} παλιές εγγραφές`);
      }

      const documents = buildDocuments(year, now);
      await collection.insertMany(documents, { ordered: false });
      inserted += documents.length;
      console.log(`✔️  ${year.startYear}: ${documents.length} επιτυχόντες`);
    }

    const total = await collection.countDocuments({});
    console.log('\n📊 Σύνοψη');
    console.log(`   Εισήχθησαν:     ${inserted}`);
    if (replaced > 0) console.log(`   Αντικαταστάθηκαν: ${replaced}`);
    if (skipped > 0) console.log(`   Παραλείφθηκαν:  ${skipped}`);
    console.log(`   Σύνολο στη βάση: ${total}`);
  } finally {
    await client.close();
  }
}

main()
  .then(() => {
    console.log('\n🎉 Ολοκληρώθηκε.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ ${error.message}`);
    process.exit(1);
  });
