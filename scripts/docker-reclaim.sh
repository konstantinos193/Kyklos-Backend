#!/bin/bash
# Weekly disk reclaim for this host.
#
# The deploy script already prunes after every deploy, but that only helps on a
# week somebody deploys. This runs on a timer instead, and is deliberately the
# narrow, always-safe subset of what the deploy does, because this box is shared
# with other projects (asterias, adinfinity, melissourgoi) and a scheduled job
# has nobody watching it.
#
# What it will NOT do, and why:
#   docker image prune -a  - removes every image without a running container,
#                            which is exactly what the blue/green rollback
#                            target is
#   docker container prune - the stopped green container IS the rollback
#   docker volume prune    - uploads, MongoDB and Redis live in volumes
#   docker system prune    - all of the above at once
#
# Install: see docker-reclaim.timer next to this file.

set -u

log() { echo "[docker-reclaim] $*"; }

before=$(df -B1 --output=avail /var/lib 2>/dev/null | tail -1)

# Untagged layers left behind when a tag is re-pointed by a rebuild. Never a
# named image, so nothing can be referencing it by name.
log "pruning dangling images"
docker image prune -f 2>&1 | tail -1

# Build cache is regenerable by definition. A week is well past the point where
# it still speeds up a build of current code.
log "pruning build cache older than 7 days"
docker builder prune -f --filter until=168h 2>&1 | tail -1

# Container stdout logs. docker-compose.yml caps these for the kyklos services,
# but that only applies once a container is recreated, and the other projects on
# this host have no cap at all. Truncating is safe on a running container: the
# daemon holds the file open in append mode and simply carries on at offset 0.
log "truncating container logs over 100MB"
find /var/lib/docker/containers -name '*-json.log' -size +100M 2>/dev/null \
    | while read -r logfile; do
        cid=$(basename "$(dirname "$logfile")")
        name=$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null || echo "$cid")
        size=$(du -h "$logfile" | cut -f1)
        truncate -s 0 "$logfile" && log "  truncated $size from $name"
    done

# Journald keeps growing until it is told not to.
journalctl --vacuum-size=200M >/dev/null 2>&1 || true

after=$(df -B1 --output=avail /var/lib 2>/dev/null | tail -1)
awk -v b="$before" -v a="$after" \
    'BEGIN { printf "[docker-reclaim] free: %.1fGB -> %.1fGB (reclaimed %.0fMB)\n",
             b/1073741824, a/1073741824, (a-b)/1048576 }'
