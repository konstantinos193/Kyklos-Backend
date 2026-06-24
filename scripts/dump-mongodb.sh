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

# Configuration
MONGODB_URI="mongodb+srv://konstantinosblavakis_db_user:7o1dMcqLBSC13Gmg@cluster0.crmxcxc.mongodb.net/kyklos_db?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME="kyklos_db"
DUMP_DIR="./mongodb-dump"
VPS_HOST="root@194.99.21.157"
VPS_DUMP_DIR="/tmp/mongodb-dump"

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
