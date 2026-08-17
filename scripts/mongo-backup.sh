#!/bin/bash
# Daily MongoDB backup.
#
# The database used to live in Atlas, where losing this host lost nothing. It
# now runs in a container on this host, so the only copy of every επιτυχόντας,
# every archive record and every admin account is on one disk. This is what
# makes that survivable.
#
# Credentials are passed to the container with --env-file rather than sourced
# into this shell: an Atlas URI contains `&`, and `. ./.env.docker` makes bash
# read that as a background job and leaves the variable empty. Docker parses the
# file itself and does not care.
#
# Install: see mongo-backup.timer next to this file.

set -u

ENV_FILE=${ENV_FILE:-/root/kyklos-backend/.env.docker}
BACKUP_DIR=${BACKUP_DIR:-/root/kyklos-backups}
KEEP_DAYS=${KEEP_DAYS:-14}
NETWORK=${NETWORK:-kyklos-backend_kyklos-network}

log() { echo "[mongo-backup] $*"; }

[ -r "$ENV_FILE" ] || { log "cannot read $ENV_FILE"; exit 1; }

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M)
ARCHIVE="kyklos-$STAMP.archive.gz"

log "dumping to $BACKUP_DIR/$ARCHIVE"
docker run --rm --env-file "$ENV_FILE" --network "$NETWORK" \
    -v "$BACKUP_DIR:/backup" mongo:7.0 \
    sh -c 'mongodump --uri="$MONGODB_URI" --archive=/backup/'"$ARCHIVE"' --gzip' \
    >/dev/null 2>&1

# A mongodump that fails still leaves a file behind, so success is judged on the
# archive being readable rather than on the exit code alone.
if [ ! -s "$BACKUP_DIR/$ARCHIVE" ]; then
    log "FAILED: no archive written"
    exit 1
fi

COLLECTIONS=$(docker run --rm --network "$NETWORK" -v "$BACKUP_DIR:/backup" mongo:7.0 \
    mongorestore --uri="mongodb://kyklos-mongodb:27017" --archive="/backup/$ARCHIVE" \
                 --gzip --dryRun -v 2>&1 | grep -c 'found collection .*bson')

if [ "$COLLECTIONS" -lt 1 ]; then
    log "FAILED: archive contains no collections - keeping it for inspection"
    exit 1
fi

log "ok: $(du -h "$BACKUP_DIR/$ARCHIVE" | cut -f1), $COLLECTIONS collections"

# Prune old dumps. Only ever this script's own naming, never the directory.
find "$BACKUP_DIR" -maxdepth 1 -name 'kyklos-*.archive.gz' -mtime +"$KEEP_DAYS" -print -delete \
    | while read -r old; do log "pruned $(basename "$old")"; done

log "$(ls -1 "$BACKUP_DIR"/kyklos-*.archive.gz 2>/dev/null | wc -l) backups on disk"
