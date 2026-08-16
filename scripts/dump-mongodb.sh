#!/bin/bash

# MongoDB Dump and Transfer Script
# Dumps production MongoDB Atlas and transfers to VPS

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $1"
}

# Configuration.
#
# The connection string is taken from the environment and is never written down
# here. This file had the live Atlas URI - username, password and cluster -
# committed into a public repository, where GitHub's secret scanner found it.
#
# Supply it per run, from the env file that is no longer tracked:
#
#   set -a; . ./.env.docker; set +a; ./scripts/dump-mongodb.sh
#
# or explicitly:
#
#   MONGODB_URI='mongodb+srv://...' VPS_HOST=root@host ./scripts/dump-mongodb.sh
: "${MONGODB_URI:?set MONGODB_URI (see the comment above) - refusing to guess}"

DB_NAME="${DB_NAME:-kyklos_db}"
DUMP_DIR="${DUMP_DIR:-./mongodb-dump}"
# Not a credential, and every other script here names it, so it keeps a default.
VPS_HOST="${VPS_HOST:-root@194.99.21.157}"
VPS_DUMP_DIR="${VPS_DUMP_DIR:-/tmp/mongodb-dump}"

log "Starting MongoDB dump process..."

# Create dump directory
mkdir -p "$DUMP_DIR"

# Dump database
log "Dumping database from MongoDB Atlas..."
mongodump --uri="$MONGODB_URI" --db="$DB_NAME" --out="$DUMP_DIR"

if [ $? -eq 0 ]; then
    log_success "Database dump completed"
else
    log_error "Database dump failed"
    exit 1
fi

# Create archive
log "Creating archive..."
ARCHIVE_NAME="mongodb-dump-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$ARCHIVE_NAME" -C "$DUMP_DIR" .

log_success "Archive created: $ARCHIVE_NAME"

# Transfer to VPS
log "Transferring archive to VPS..."
scp "$ARCHIVE_NAME" "$VPS_HOST:$VPS_DUMP_DIR/"

if [ $? -eq 0 ]; then
    log_success "Transfer completed"
else
    log_error "Transfer failed"
    exit 1
fi

# Cleanup local dump
log "Cleaning up local files..."
rm -rf "$DUMP_DIR"
rm -f "$ARCHIVE_NAME"

log_success "Local cleanup completed"

log "MongoDB dump and transfer completed successfully"
log "Archive location on VPS: $VPS_DUMP_DIR/$ARCHIVE_NAME"
