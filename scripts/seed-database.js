require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_EMAIL = 'konstantinosblavakis@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Kk.25102002?';

// Collections to seed with 500 entries each
const COLLECTIONS_TO_SEED = [
  'students',
  'blogs',
  'newsletters',
  'news',
  'exercises',
  'exammaterials',
  'panhellenicarchive',
  'teacherpermissions'
];

// Helper functions to generate random data
const firstNames = ['Γιώργος', 'Μαρία', 'Νίκος', 'Ελένη', 'Κώστας', 'Αννα', 'Δημήτρης', 'Σοφία', 'Αλέξανδρος', 'Κατερίνα', 'Παναγιώτης', 'Βασιλική', 'Θανάσης', 'Χριστίνα', 'Μιχάλης', 'Δέσποινα'];
const lastNames = ['Παπαδόπουλος', 'Γεωργίου', 'Νικολάου', 'Κωνσταντίνου', 'Αλεξάνδρου', 'Μιχαήλ', 'Χριστόπουλος', 'Ευαγγέλου', 'Δημητρίου', 'Αθανασίου'];
const cities = ['Άρτα', 'Αθήνα', 'Θεσσαλονίκη', 'Πάτρα', 'Ηράκλειο', 'Λάρισα', 'Βόλος', 'Ιωάννινα', 'Καλαμάτα', 'Χανιά'];
const grades = ['Α Λυκείου', 'Β Λυκείου', 'Γ Λυκείου'];
const subjects = ['Μαθηματικά', 'Φυσική', 'Χημεία', 'Βιολογία', 'Γλώσσα', 'Ιστορία', 'Αγγλικά'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmail(firstName, lastName) {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1, 999)}@${randomItem(domains)}`;
}

function randomPhone() {
  return `69${randomInt(0, 9)}${randomInt(1000000, 9999999)}`;
}

function generateStudentData(i) {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  return {
    firstName,
    lastName,
    email: randomEmail(firstName, lastName),
    phone: randomPhone(),
    grade: randomItem(grades),
    city: randomItem(cities),
    address: `${randomInt(1, 200)} ${randomItem(['Οδός', 'Λεωφόρος'])} ${randomItem(['Αθήνας', 'Πατησίων', 'Κηφισίας', 'Μητροπόλεως'])}`,
    parentName: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
    parentPhone: randomPhone(),
    status: randomItem(['active', 'inactive', 'pending']),
    hasAccessToThemata: Math.random() > 0.5,
    registrationDate: new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000)),
    lastLogin: Math.random() > 0.3 ? new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)) : null,
    uniqueKey: `STU-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${String.fromCharCode(65 + randomInt(0, 25))}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateBlogData(i) {
  const titles = [
    'Πώς να προετοιμαστείτε για τις Πανελλαδικές',
    'Στρατηγικές για τα Μαθηματικά',
    'Τα μυστικά της Φυσικής',
    'Χημεία: Οδηγός επιτυχίας',
    'Βιολογία απλά και κατανοητά',
    'Διαχείριση χρόνου κατά την διάρκεια εξετάσεων',
    'Ψυχολογία μαθητή και εξετάσεις',
    'Ο ρόλος των φροντιστηρίων',
    'Συμβουλές για γονείς',
    'Μετά τις εξετάσεις: Τι να κάνετε'
  ];
  
  return {
    title: `${randomItem(titles)} - Μέρος ${i + 1}`,
    slug: `blog-post-${i + 1}-${Date.now()}`,
    excerpt: 'Αυτό είναι ένα δείγμα περιεχομένου για το άρθρο. Περιέχει χρήσιμες πληροφορίες για τους μαθητές.',
    content: 'Πλήρες περιεχόμενο του άρθρου που περιλαμβάνει αναλυτικές πληροφορίες, συμβουλές και οδηγίες για τους μαθητές που προετοιμάζονται για τις εξετάσεις.',
    category: randomItem(['Εξετάσεις', 'Σπουδές', 'Ψυχολογία', 'Οικογένεια']),
    tags: [randomItem(['πανελλαδικές', 'φροντιστήριο', 'μαθηματικά', 'φυσική', 'χημεία'])],
    author: randomItem(firstNames) + ' ' + randomItem(lastNames),
    status: 'published',
    featured: Math.random() > 0.8,
    publishDate: new Date(Date.now() - randomInt(0, 180 * 24 * 60 * 60 * 1000)),
    views: randomInt(0, 5000),
    readTime: `${randomInt(2, 10)} λεπτά`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateNewsletterData(i) {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  return {
    email: randomEmail(firstName, lastName),
    name: `${firstName} ${lastName}`,
    subscribedAt: new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000)),
    isActive: Math.random() > 0.1,
    unsubscribedAt: Math.random() > 0.8 ? new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateNewsData(i) {
  const headlines = [
    'Νέα προγράμματα σπουδών ανακοινώθηκαν',
    'Αλλαγές στις πανελλαδικές εξετάσεις',
    'Επιτυχίες των μαθητών μας',
    'Εγγραφές για τη νέα χρονιά',
    'Σεμινάρια για γονείς',
    'Ανοιχτή ημέρα φροντιστηρίου'
  ];
  
  return {
    title: `${randomItem(headlines)} ${i + 1}`,
    slug: `news-${i + 1}-${Date.now()}`,
    content: 'Πλήρες περιεχόμενο της είδησης με όλες τις απαραίτητες πληροφορίες.',
    category: randomItem(['Ανακοινώσεις', 'Εκδηλώσεις', 'Επιτυχίες', 'Εκπαιδευτικά']),
    status: 'published',
    publishDate: new Date(Date.now() - randomInt(0, 90 * 24 * 60 * 60 * 1000)),
    views: randomInt(0, 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateExerciseData(i) {
  return {
    title: `Άσκηση ${i + 1} - ${randomItem(subjects)}`,
    subject: randomItem(subjects),
    grade: randomItem(grades),
    difficulty: randomItem(['Εύκολη', 'Μέτρια', 'Δύσκολη']),
    content: 'Περιεχόμενο της άσκησης με την εκφώνηση και τις οδηγίες επίλυσης.',
    solution: 'Λύση της άσκησης με αναλυτικά βήματα.',
    tags: [randomItem(['άσκηση', 'εξάσκηση', 'πρόβλημα'])],
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateExamMaterialData(i) {
  return {
    title: `Υλικό εξετάσεων ${i + 1} - ${randomItem(subjects)}`,
    subject: randomItem(subjects),
    grade: randomItem(grades),
    year: randomInt(2015, 2024),
    type: randomItem(['Θέματα', 'Λύσεις', 'Πρόγραμμα']),
    description: 'Περιγραφή του υλικού εξετάσεων',
    fileUrl: `/uploads/exam-material-${i + 1}.pdf`,
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generatePanhellenicArchiveData(i) {
  return {
    title: `Αρχείο Πανελληνίων ${i + 1} - ${randomInt(2010, 2023)}`,
    year: randomInt(2010, 2023),
    subject: randomItem(subjects),
    type: randomItem(['Θέματα', 'Λύσεις', 'Στατιστικά']),
    description: 'Αρχείο πανελληνικών εξετάσεων με θέματα και λύσεις',
    fileUrl: `/uploads/panhellenic-${i + 1}.pdf`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function generateTeacherPermissionData(i) {
  return {
    teacherId: `teacher-${i + 1}`,
    teacherName: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
    email: randomEmail(randomItem(firstNames), randomItem(lastNames)),
    permissions: {
      students: { create: Math.random() > 0.3, read: true, update: Math.random() > 0.4, delete: Math.random() > 0.8 },
      blog: { create: Math.random() > 0.5, read: true, update: Math.random() > 0.6, delete: Math.random() > 0.9 },
      newsletter: { create: Math.random() > 0.4, read: true, update: Math.random() > 0.5, delete: Math.random() > 0.8 },
      settings: { read: Math.random() > 0.7, update: Math.random() > 0.9 },
    },
    isActive: Math.random() > 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function createSuperAdmin(db) {
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, salt);

  const adminDocument = {
    email: SUPER_ADMIN_EMAIL.toLowerCase(),
    password: hashedPassword,
    name: 'Konstantinos Blavakis',
    role: 'admin',
    isActive: true,
    permissions: {
      students: { create: true, read: true, update: true, delete: true },
      blog: { create: true, read: true, update: true, delete: true },
      newsletter: { create: true, read: true, update: true, delete: true },
      settings: { read: true, update: true },
      teachers: { create: true, read: true, update: true, delete: true },
    },
    createdAt: new Date(),
    lastLogin: null,
    updatedAt: new Date(),
  };

  await db.collection('admins').deleteOne({ email: SUPER_ADMIN_EMAIL.toLowerCase() });
  await db.collection('admins').insertOne(adminDocument);
  console.log('✅ Super admin created');
  console.log(`📧 Email: ${SUPER_ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${SUPER_ADMIN_PASSWORD}`);
}

async function seedCollection(db, collectionName, dataGenerator) {
  console.log(`📝 Seeding ${collectionName}...`);
  const data = [];
  for (let i = 0; i < 500; i++) {
    data.push(dataGenerator(i));
  }
  await db.collection(collectionName).deleteMany({});
  await db.collection(collectionName).insertMany(data);
  console.log(`✅ ${collectionName} seeded with 500 entries`);
}

async function seedDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'kyklos_frontistirio';

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`📊 Connected to database: ${dbName}`);

    // Create super admin
    await createSuperAdmin(db);

    // Seed collections
    await seedCollection(db, 'students', generateStudentData);
    await seedCollection(db, 'blogs', generateBlogData);
    await seedCollection(db, 'newsletters', generateNewsletterData);
    await seedCollection(db, 'news', generateNewsData);
    await seedCollection(db, 'exercises', generateExerciseData);
    await seedCollection(db, 'exammaterials', generateExamMaterialData);
    await seedCollection(db, 'panhellenicarchive', generatePanhellenicArchiveData);
    await seedCollection(db, 'teacherpermissions', generateTeacherPermissionData);

    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Failed to seed database:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

seedDatabase().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
