require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');

const REQUIRED_ENV = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const TARGET_PREFIX =
  process.env.RESET_CLOUDINARY_PREFIX ||
  process.env.CLOUDINARY_RESET_PREFIX ||
  '';

async function deleteByPrefix(prefix, resourceType) {
  console.log(`🧹 Deleting ${resourceType} resources with prefix "${prefix}"...`);
  let nextCursor;

  do {
    const options = {
      resource_type: resourceType,
      type: 'upload',
      max_results: 500,
    };

    if (nextCursor) {
      options.next_cursor = nextCursor;
    }

    const result = await cloudinary.api.delete_resources_by_prefix(prefix, options);
    nextCursor = result.next_cursor;
    console.log(
      `   ↳ Deleted ${Object.keys(result.deleted || {}).length} ${resourceType} resources${
        nextCursor ? ' (continuing)' : ''
      }`,
    );
  } while (nextCursor);
}

async function deleteAll(resourceType) {
  console.log(`🧨 Deleting ALL ${resourceType} resources...`);
  const result = await cloudinary.api.delete_all_resources({
    resource_type: resourceType,
    type: 'upload',
  });
  console.log(
    `   ↳ Deleted ${Object.keys(result.deleted || {}).length} ${resourceType} resources.`,
  );
}

async function deleteFolders(prefix) {
  const foldersToDelete = [];

  if (prefix) {
    const parts = prefix.split('/').filter(Boolean);
    for (let i = parts.length; i > 0; i--) {
      foldersToDelete.push(parts.slice(0, i).join('/'));
    }
  } else {
    const gatherFolders = async (parent) => {
      const listFn = parent
        ? cloudinary.api.sub_folders.bind(cloudinary.api, parent)
        : cloudinary.api.root_folders.bind(cloudinary.api);

      const { folders = [] } = await listFn();

      for (const folder of folders) {
        await gatherFolders(folder.path);
        foldersToDelete.push(folder.path);
      }
    };

    await gatherFolders('');
  }

  for (const folder of foldersToDelete) {
    try {
      await cloudinary.api.delete_folder(folder);
      console.log(`   ↳ Deleted folder "${folder}"`);
    } catch (error) {
      if (error.error && error.error.http_code === 404) {
        continue;
      }
      console.warn(`   ⚠️  Could not delete folder "${folder}": ${error.message || error}`);
    }
  }
}

async function resetCloudinary() {
  console.log('⚠️  This will permanently delete Cloudinary assets.');
  const intendedTarget = TARGET_PREFIX ? `prefix "${TARGET_PREFIX}"` : 'the entire account';
  console.log(`   Target scope: ${intendedTarget}`);

  try {
    if (TARGET_PREFIX) {
      await deleteByPrefix(TARGET_PREFIX, 'image');
      await deleteByPrefix(TARGET_PREFIX, 'video');
      await deleteByPrefix(TARGET_PREFIX, 'raw');
    } else {
      await deleteAll('image');
      await deleteAll('video');
      await deleteAll('raw');
    }

    await deleteFolders(TARGET_PREFIX);

    console.log('✅ Cloudinary reset complete.');
  } catch (error) {
    console.error('❌ Failed to reset Cloudinary:', error.message || error);
    process.exit(1);
  }
}

resetCloudinary();


