# Cleanup Plan - Remove Old Express.js Files

## Files/Directories to Remove (Not Used by NestJS)

### ✅ Safe to Remove:
1. **`server.js`** - Old Express.js entry point (replaced by `src/main.ts`)
2. **`routes/`** - Old Express.js routes (replaced by NestJS controllers)
3. **`models/`** - Old Express.js models (replaced by direct MongoDB access in services)
4. **`middleware/`** - Old Express.js middleware (replaced by NestJS guards)
5. **`config/`** - Old Express.js config (replaced by NestJS ConfigModule)
6. **`utils/`** - Old utilities (replaced by NestJS services)
7. **`nodemon.json`** - Not needed (NestJS has built-in watch mode)

### ⚠️ Keep for Now (May Still Be Used):
1. **`create-admin-simple.js`** - Admin creation script (needs update to use NestJS)
2. **`test-*.js`** - Test scripts (may need updating)
3. **`MIGRATION_SUMMARY.md`** - Documentation (can keep or remove)

### 📁 Keep:
- **`public/`** - Static files (still used)
- **`src/`** - NestJS source code
- **`dist/`** - Build output
- **`node_modules/`** - Dependencies
- **`.env`**, **`env.example`** - Environment config
- **`package.json`**, **`yarn.lock`** - Package management
- **`tsconfig.json`**, **`nest-cli.json`** - TypeScript/NestJS config

## Cleanup Commands

```bash
# Remove old Express.js files
rm server.js
rm -rf routes/
rm -rf models/
rm -rf middleware/
rm -rf config/
rm -rf utils/
rm nodemon.json

# Optional: Remove test scripts (if not needed)
rm test-*.js

# Optional: Remove migration docs
rm MIGRATION_SUMMARY.md
```

## After Cleanup

The backend will be 100% NestJS with no legacy Express.js code remaining.

