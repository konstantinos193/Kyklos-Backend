#!/usr/bin/env node
/**
 * Creates (or resets the password of) an admin account directly in MongoDB.
 *
 * The HTTP endpoint POST /api/admin/auth/create only accepts unauthenticated calls
 * while no admin exists, so this script is the supported way to add further accounts
 * from the server, and the recovery path if you are locked out.
 *
 * Usage:
 *   node scripts/create-admin.js <email> <password> [name] [role]
 *
 * Roles: super_admin (default) | admin | moderator
 * Reads MONGODB_URI and MONGODB_DB_NAME from the environment.
 */
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function main() {
  const [email, password, name = 'Administrator', role = 'super_admin'] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> [name] [role]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Refusing to create an admin with a password shorter than 8 characters.');
    process.exit(1);
  }

  if (!['super_admin', 'admin', 'moderator'].includes(role)) {
    console.error(`Unknown role "${role}". Use super_admin, admin or moderator.`);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(process.env.MONGODB_DB_NAME || 'kyklos_frontistirio');
    const admins = db.collection('admins');
    const normalisedEmail = email.toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await admins.findOne({ email: normalisedEmail });

    if (existing) {
      await admins.updateOne(
        { _id: existing._id },
        { $set: { password: hashedPassword, isActive: true, updatedAt: new Date() } },
      );
      console.log(`Password reset for existing admin ${normalisedEmail} (role: ${existing.role}).`);
      return;
    }

    await admins.insertOne({
      email: normalisedEmail,
      password: hashedPassword,
      name,
      role,
      isActive: true,
      permissions: {
        students: { create: true, read: true, update: true, delete: true },
        blog: { create: true, read: true, update: true, delete: true },
        newsletter: { create: true, read: true, update: true, delete: true },
        settings: { read: true, update: true },
      },
      createdAt: new Date(),
    });

    console.log(`Created admin ${normalisedEmail} with role ${role}.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('Failed to create admin:', error.message);
  process.exit(1);
});
