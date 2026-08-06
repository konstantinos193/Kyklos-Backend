#!/bin/bash
# Zero-Downtime Deployment Script - Kyklos Backend
#
# Usage: ./deploy-zero-downtime.sh <color> [image]
#   ./deploy-zero-downtime.sh green                        # build on the host, tag dev-<N>
#   ./deploy-zero-downtime.sh green ghcr.io/org/api:dev-7  # pull a prebuilt image
#
# Traffic is switched by the containerised nginx (kyklos-nginx), which the host
# nginx fronts on localhost:8081. The backend containers publish no host ports;
# they are reached over kyklos-network by container name.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo -e "${RED}Usage: $0 <color> [image]${NC}"
    echo -e "${YELLOW}Example: $0 green${NC}"
    echo -e "${YELLOW}Example: $0 green ghcr.io/user/kyklos-backend:dev-123${NC}"
    exit 1
fi

DEPLOY_COLOR=$1
NEW_IMAGE=${2:-}

# Docker requires lowercase image references.
[ -n "$NEW_IMAGE" ] && NEW_IMAGE=$(echo "$NEW_IMAGE" | tr '[:upper:]' '[:lower:]')

if [ "$DEPLOY_COLOR" != "green" ] && [ "$DEPLOY_COLOR" != "blue" ]; then
    echo -e "${RED}Error: Color must be 'green' or 'blue'${NC}"
    exit 1
fi

OTHER_COLOR=$([ "$DEPLOY_COLOR" = "green" ] && echo "blue" || echo "green")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINER="kyklos-backend-$DEPLOY_COLOR"
OTHER_CONTAINER="kyklos-backend-$OTHER_COLOR"
NGINX_CONTAINER="kyklos-nginx"
NGINX_CONF="nginx/conf.d/kyklos.conf"
NGINX_CONF_BACKUP="/tmp/kyklos.conf.predeploy.$$"
ENV_FILE=".env.docker"

# Public entrypoint of the containerised nginx, as published in docker-compose.yml.
# The host nginx (api.kyklosedu.gr) proxies to this same port.
PROXY_PORT=${PROXY_PORT:-8081}

# docker-compose v1 and the v2 plugin take the same arguments here.
if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
else
    COMPOSE="docker-compose"
fi
COMPOSE="$COMPOSE --env-file $ENV_FILE"

# How many tagged images of this repo to retain after a successful deploy.
#
# This is a disk budget, not a preference. Two is the live image plus one
# rollback target -- the idle colour's container still points at the previous
# tag, and that tag is what a rollback re-runs.
KEEP_IMAGES=${KEEP_IMAGES:-2}

# Free space, in GB, the build/pull must have before it is allowed to start. A
# build writes intermediate layers and a pull extracts on top of the compressed
# download, so the peak is well above what the finished image occupies. Running
# out mid-way leaves a half-written layer and no working deploy.
MIN_FREE_GB=${MIN_FREE_GB:-2}

# Image repository this host manages. Reclaim sweeps every repo matching it, not
# only the tag being deployed: the filesystem is shared with MongoDB, Redis and
# nginx images, so surplus backend tags are what there is to give back.
MANAGED_IMAGE_PREFIX=${MANAGED_IMAGE_PREFIX:-kyklos-backend}

# Host-wide deploy lock.
#
# Two deploys against this box at once will race: one script reaching its image
# cleanup while the other is mid build or pull lets containerd GC collect the
# lease protecting the incoming, still-untagged layers. The lock lives on the
# host because the host is the only thing concurrent pipelines share, and it is
# worthless unless every deploy path takes it.
LOCK_FILE=${LOCK_FILE:-/var/lock/kyklos-deploy.lock}
LOCK_WAIT=${LOCK_WAIT:-900}

exec 9>"$LOCK_FILE" || { echo -e "${RED}Error: cannot open $LOCK_FILE${NC}"; exit 1; }
echo -e "${YELLOW}Acquiring host deploy lock...${NC}"
if ! flock -w "$LOCK_WAIT" 9; then
    echo -e "${RED}✗ Timed out after ${LOCK_WAIT}s waiting for another deploy to release the lock${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deploy lock acquired${NC}"

# Tag for a host-built image. dev-N is the commit count: monotonic by
# construction, which is what the keep-N ordering below sorts on.
if [ -z "$NEW_IMAGE" ]; then
    BUILD_NUMBER=${BUILD_NUMBER:-$(git rev-list --count HEAD 2>/dev/null || echo 0)}
    NEW_IMAGE="${MANAGED_IMAGE_PREFIX}:dev-${BUILD_NUMBER}"
    BUILD_LOCALLY=1
else
    BUILD_LOCALLY=
fi

# docker-compose.yml reads this for both colours' `image:`.
export BACKEND_IMAGE="$NEW_IMAGE"

echo -e "${GREEN}=== Zero-Downtime Deployment ===${NC}"
echo -e "${YELLOW}Deploy Color: $DEPLOY_COLOR${NC}"
echo -e "${YELLOW}New Image: $NEW_IMAGE${NC}"
echo -e "${YELLOW}Other Color: $OTHER_COLOR${NC}"
echo -e "${YELLOW}Source: $([ -n "$BUILD_LOCALLY" ] && echo 'host build' || echo 'registry pull')${NC}"
echo ""

# A registry blip should not fail an otherwise good deploy.
pull_with_retry() {
    local image="$1"
    local attempt=1
    local max=3

    while true; do
        if docker pull "$image"; then
            return 0
        fi
        if [ "$attempt" -ge "$max" ]; then
            echo -e "${RED}✗ Pull failed after $max attempts${NC}"
            return 1
        fi
        echo -e "${YELLOW}Pull failed (attempt $attempt/$max), retrying in $((attempt * 10))s...${NC}"
        sleep $((attempt * 10))
        attempt=$((attempt + 1))
    done
}

# Bytes available on the filesystem holding the image store.
#
# `docker info` reports /var/lib/docker, but a host running the containerd
# snapshotter extracts layers into /var/lib/containerd instead. /var/lib covers
# both.
free_bytes() {
    df -B1 --output=avail /var/lib 2>/dev/null | tail -1
}

human_gb() {
    awk -v b="${1:-0}" 'BEGIN { printf "%.1fGB", b / 1073741824 }'
}

# Every image ID a container still points at. Matching on the tag string alone
# is not enough: a container created from a tag that has since been re-pointed
# still pins the old ID, and `docker rmi` on that tag would leave the container
# referencing an image nothing names any more.
in_use_image_ids() {
    docker ps -a -q | xargs -r docker inspect --format '{{.Image}}' 2>/dev/null | sort -u
}

# Tags of $repo, newest first.
#
# Explicitly NOT `docker images`' default order. That sorts on the image's
# *created* timestamp, which is not trustworthy: two tags built in the same
# second carry an identical timestamp and can come back in either order. A
# keep-N cut on that is a coin flip that can retain the older image and delete
# the newer one.
#
# dev-N is monotonic by construction, so sort on that. A tag with no numeric
# dev-N suffix sorts first and so is never surplus -- it is something a human
# staged (`:latest`, a hand-tagged rollback point), and this will not guess.
repo_tags_newest_first() {
    docker images "$1" --format '{{.Repository}}:{{.Tag}}' \
        | grep -v ':<none>$' \
        | while read -r ref; do
            case "${ref##*:}" in
                dev-[0-9]*) printf '%s\t%s\n' "${ref##*:dev-}" "$ref" ;;
                *)          printf '%s\t%s\n' 999999999 "$ref" ;;
            esac
        done \
        | sort -k1,1nr \
        | cut -f2
}

# Image IDs of the surplus tags of $repo -- everything outside the newest $keep.
surplus_image_ids() {
    local repo="$1" keep="$2"
    repo_tags_newest_first "$repo" \
        | tail -n +"$((keep + 1))" \
        | while read -r ref; do
            docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null
        done
}

# Drop all but the newest $keep tags of $repo, skipping any image a container
# still references -- the live container and the idle rollback target.
#
# `docker image prune -f` only ever removes *dangling* images. Every tag here is
# a named dev-N, so it reclaims nothing while still triggering the containerd GC
# sweep that races concurrent pulls. Remove named tags instead.
cleanup_old_images() {
    local repo="$1"
    local keep="${2:-2}"
    local in_use_ids
    in_use_ids=$(in_use_image_ids)

    # Same ordering as surplus_image_ids, and it has to stay that way: if the
    # two disagree about which tags are surplus, release_stale_pins can drop a
    # container guarding an image this then decides to keep.
    repo_tags_newest_first "$repo" \
        | tail -n +"$((keep + 1))" \
        | while read -r ref; do
            local id
            id=$(docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null)
            if [ -n "$id" ] && printf '%s\n' "$in_use_ids" | grep -qxF "$id"; then
                echo -e "  ${YELLOW}pinned by a container, kept: $ref${NC}"
            elif docker rmi "$ref" >/dev/null 2>&1; then
                echo -e "  ${GREEN}removed: $ref${NC}"
            else
                echo -e "  ${YELLOW}skipped: $ref${NC}"
            fi
        done
}

# Remove stopped containers that pin an image we are trying to drop anyway.
#
# cleanup_old_images refuses to remove any image a container references, and
# nothing in the pipeline ever removes a stopped container -- so one leftover
# pins its whole image forever and permanently shrinks the disk budget. A box
# that reports "pinned by a container, kept" for everything frees nothing and
# eventually cannot deploy at all.
#
# The keep-N window is the safety rule that makes this safe to automate. A
# stopped container whose image is still retained is the blue/green rollback
# target and is left strictly alone. Only one pinning an image already outside
# the window is removed -- it has nothing left to roll back to, because the
# image it needs is being deleted in the very next step.
#
# Running containers are never considered, whatever they are running.
release_stale_pins() {
    local repo="$1" keep="$2"
    local surplus_ids
    surplus_ids=$(surplus_image_ids "$repo" "$keep")
    [ -n "$surplus_ids" ] || return 0

    # Repeated --filter status= values are OR'd, so this is every non-running
    # container: exited, created but never started, and dead.
    docker ps -a --filter status=exited --filter status=created --filter status=dead \
              --format '{{.ID}} {{.Names}}' \
        | while read -r cid cname; do
            local id
            id=$(docker inspect --format '{{.Image}}' "$cid" 2>/dev/null) || continue
            if printf '%s\n' "$surplus_ids" | grep -qxF "$id" \
               && docker rm -f "$cid" >/dev/null 2>&1; then
                echo -e "  ${GREEN}removed stopped container pinning a dropped image: $cname${NC}"
            fi
        done
}

# Non-Docker residue on the deploy host.
#
# Docker reclaim can be a complete no-op and the disk still be full: every image
# inside the keep-N window and every container holding one running is a
# perfectly healthy state that frees zero bytes. What actually ate the disk is
# often not Docker's at all -- a runner's own install tarball, already unpacked
# into the directory next to it and never read again, plus unbounded _diag logs
# and an apt cache for packages that are already installed.
#
# Everything swept here is already-consumed by construction. None of it is state.
reclaim_host_space() {
    local runner_home="${RUNNER_HOME:-$HOME}"

    find "$runner_home" -maxdepth 2 -name 'actions-runner-linux-*.tar.gz' \
        -delete 2>/dev/null || true

    # Runner diagnostics grow unbounded. Three days is well past the point they
    # can still explain the run that wrote them.
    find "$runner_home"/*/_diag -maxdepth 1 -name '*.log' -mtime +3 \
        -delete 2>/dev/null || true

    # .deb archives for packages that are already installed.
    sudo -n apt-get clean >/dev/null 2>&1 || true

    # Rotated nginx logs from the compose stack's bind mount.
    find "$SCRIPT_DIR/logs/nginx" -maxdepth 1 -name '*.log.*' -mtime +7 \
        -delete 2>/dev/null || true
}

# Free space without touching anything a *running* container references. Safe to
# call at any point, including before the build -- every stage is a no-op when
# there is nothing to take.
#
# Pass "aggressive" to also break stale pins and sweep non-Docker space. That
# escalation only runs when the alternative is refusing to deploy at all, so it
# is deliberately not the default for the routine post-deploy tidy.
reclaim_disk() {
    local aggressive="${1:-}"
    echo -e "${YELLOW}Reclaiming disk (before: $(human_gb "$(free_bytes)") free)...${NC}"

    # Untagged leftovers and the build cache. Nothing depends on either.
    docker image prune -f >/dev/null 2>&1 || true
    docker builder prune -f >/dev/null 2>&1 || true

    local repo
    for repo in $(docker images --format '{{.Repository}}' \
                    | grep -F "$MANAGED_IMAGE_PREFIX" | sort -u); do
        # `if`, not `[ ... ] && ...`: under `set -e` a bare AND-list that fails
        # its test exits the whole script.
        if [ -n "$aggressive" ]; then
            release_stale_pins "$repo" "$KEEP_IMAGES"
        fi
        cleanup_old_images "$repo" "$KEEP_IMAGES"
    done

    if [ -n "$aggressive" ]; then
        # Journald grows unbounded unless capped; this collects anything already
        # written before a cap was in place.
        sudo -n journalctl --vacuum-size=200M >/dev/null 2>&1 || true

        # Non-Docker space. Deliberately in the aggressive branch: this is
        # residue, but deleting a human's files is still not something the
        # routine post-deploy tidy should do unprompted.
        reclaim_host_space

        # Unreferenced images from OUTSIDE the managed repo: a base image left
        # behind by a manual build, a stale buildkit.
        #
        # Deliberately NOT `docker image prune -a -f`. A retained keep-N image
        # has no container attached by definition -- that is the entire point of
        # retaining it -- so a blanket -a prune removes precisely what
        # KEEP_IMAGES exists to protect, including the live rollback target. The
        # managed repo is governed by cleanup_old_images above and nothing else.
        local unref_in_use ref id
        unref_in_use=$(in_use_image_ids)
        docker images --format '{{.Repository}}:{{.Tag}}' \
            | grep -v '^<none>' | grep -v ':<none>$' \
            | grep -v "^$MANAGED_IMAGE_PREFIX" \
            | while read -r ref; do
                id=$(docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null) || continue
                if [ -n "$id" ] && printf '%s\n' "$unref_in_use" | grep -qxF "$id"; then
                    continue
                fi
                if docker rmi "$ref" >/dev/null 2>&1; then
                    echo -e "  ${GREEN}removed unreferenced image: $ref${NC}"
                fi
            done
    fi

    echo -e "${GREEN}✓ Reclaim done (after: $(human_gb "$(free_bytes)") free)${NC}"
}

# Reclaim before the image is produced, not only after a successful deploy.
#
# Cleanup that runs only on the last line of a successful deploy cannot recover
# a full disk: the first deploy too big to fit dies at the build and never
# reaches cleanup -- and so does every deploy after it. Reclaiming up front
# breaks that cycle.
ensure_disk_space() {
    local need=$((MIN_FREE_GB * 1073741824))
    local avail
    avail=$(free_bytes)

    if [ "${avail:-0}" -ge "$need" ]; then
        echo -e "${GREEN}✓ Disk OK ($(human_gb "$avail") free, need ${MIN_FREE_GB}GB)${NC}"
        return 0
    fi

    echo -e "${YELLOW}Only $(human_gb "$avail") free, need ${MIN_FREE_GB}GB${NC}"

    # Aggressive: the deploy is otherwise about to be refused, so breaking a
    # dead container's pin on an image we are deleting anyway is strictly better
    # than failing. See release_stale_pins.
    reclaim_disk aggressive
    avail=$(free_bytes)

    if [ "${avail:-0}" -ge "$need" ]; then
        return 0
    fi

    # Warn, do not block.
    #
    # The shortfall is a *prediction* that the build will not fit, and that
    # prediction is wrong often enough to be worse than the failure it guards
    # against -- reclaim only looks in the places it knows about, and a gate
    # here can refuse a deploy that would have fitted comfortably. The on_exit
    # trap below already closes the hole this was originally added for: a failed
    # run reclaims on the way out, so the death spiral is broken whether or not
    # anything is checked up front.
    #
    # A genuinely-too-large build now fails at the build, which is honest,
    # leaves the running container serving, and cleans up after itself.
    echo -e "${YELLOW}  Proceeding anyway - it may still fit, and a failed run now${NC}"
    echo -e "${YELLOW}  reclaims on exit. Current image holders, for the record:${NC}"
    docker ps -a --format '    {{.Names}}  ->  {{.Image}}  ({{.Status}})'
    echo -e "${YELLOW}  If one of these is a manual/scratch container: docker rm -f <name>${NC}"
    return 0
}

# Reclaim on the way out of a *failed* deploy too, and put the nginx upstream
# back where it was. A failure still leaves the freshly built image on disk, and
# that would otherwise sit there until the next successful run -- which is
# precisely how a box wedges, because once it is full no run can succeed and
# nothing ever cleans up again.
on_exit() {
    local rc=$?
    if [ "$rc" -ne 0 ]; then
        if [ -f "$NGINX_CONF_BACKUP" ]; then
            echo -e "${YELLOW}Restoring previous nginx upstream...${NC}"
            cp "$NGINX_CONF_BACKUP" "$NGINX_CONF"
            docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null 2>&1 || true
        fi
        echo -e "${YELLOW}Deploy failed - reclaiming so this run's image does not block the next one...${NC}"
        # Aggressive here too. A failed run is exactly when a half-dead
        # container is most likely to be left holding an image, and the next
        # run should not inherit that.
        reclaim_disk aggressive || true
    fi
    rm -f "$NGINX_CONF_BACKUP"
}
trap on_exit EXIT

# Step 1: Obtain the image
echo -e "${YELLOW}[1/7] Obtaining image...${NC}"
ensure_disk_space
if [ -n "$BUILD_LOCALLY" ]; then
    echo -e "${YELLOW}Building $NEW_IMAGE...${NC}"
    $COMPOSE build "kyklos-backend-$DEPLOY_COLOR"
else
    if [ -n "$GITHUB_TOKEN" ]; then
        echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
    fi
    pull_with_retry "$NEW_IMAGE"
fi

# Step 2: Ensure the shared network and supporting services are up.
# MongoDB, Redis and nginx are long-lived; `up -d` on them is a no-op when they
# are already running and repairs the stack when they are not.
echo -e "${YELLOW}[2/7] Ensuring network and supporting services...${NC}"
$COMPOSE up -d mongodb redis nginx
echo -e "${GREEN}✓ mongodb, redis, nginx up${NC}"

# Step 3: Remove any stale container of the colour being deployed.
#
# Force-remove regardless of how it was created: a container left by a previous
# failed run, or one created outside compose, still owns the name and would make
# the `up` below fail.
echo -e "${YELLOW}[3/7] Removing old $DEPLOY_COLOR container (if any)...${NC}"
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker stop "$CONTAINER" >/dev/null 2>&1 || true
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ Removed stale $CONTAINER${NC}"
else
    echo -e "${GREEN}✓ No stale container${NC}"
fi

# Step 4: Start the new container. The $OTHER_COLOR container keeps serving
# throughout -- nginx is not touched until this one is healthy.
echo -e "${YELLOW}[4/7] Starting $CONTAINER...${NC}"
$COMPOSE up -d "kyklos-backend-$DEPLOY_COLOR"

# Step 5: Wait for the container's own healthcheck (GET /api/health).
echo -e "${YELLOW}[5/7] Waiting for $CONTAINER to be healthy...${NC}"
MAX_RETRIES=${MAX_RETRIES:-60}
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "starting")

    if [ "$HEALTH_STATUS" = "healthy" ]; then
        echo -e "${GREEN}✓ Container is healthy!${NC}"
        break
    elif [ "$HEALTH_STATUS" = "unhealthy" ]; then
        echo -e "${RED}✗ Container is unhealthy!${NC}"
        docker logs --tail 100 "$CONTAINER"
        exit 1
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}Waiting... ($RETRY_COUNT/$MAX_RETRIES) - Status: $HEALTH_STATUS${NC}"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Health check timeout!${NC}"
    docker logs --tail 100 "$CONTAINER"
    exit 1
fi

# Step 6: Point nginx at the new colour.
#
# The upstream is rewritten in place and reloaded; the config is backed up first
# so on_exit can put it back if anything below fails. `nginx -s reload` finishes
# in-flight requests on the old upstream, which is what makes the switch
# seamless -- a restart of the proxy would not.
echo -e "${YELLOW}[6/7] Switching nginx upstream to $DEPLOY_COLOR...${NC}"
cp "$NGINX_CONF" "$NGINX_CONF_BACKUP"
sed -i -E "s/kyklos-backend-(blue|green):5000/kyklos-backend-${DEPLOY_COLOR}:5000/g" "$NGINX_CONF"

if ! docker exec "$NGINX_CONTAINER" nginx -t; then
    echo -e "${RED}✗ Nginx configuration test failed${NC}"
    exit 1
fi
docker exec "$NGINX_CONTAINER" nginx -s reload
echo -e "${GREEN}✓ Nginx reloaded${NC}"

# Verify through the proxy, not just the container: this is the first check that
# exercises the path real traffic takes.
sleep 3
if ! curl -fsS "http://localhost:${PROXY_PORT}/api/health" >/dev/null; then
    echo -e "${RED}✗ Health check through nginx failed - rolling back upstream${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Serving through nginx on port $PROXY_PORT${NC}"

# Step 7: Stop the old colour.
#
# Stopped, not removed. The container is the rollback target: `docker start
# kyklos-backend-$OTHER_COLOR` plus an upstream flip brings the previous version
# back without a rebuild, and its image is protected by the keep-N window for
# exactly as long as the container exists.
echo -e "${YELLOW}[7/7] Stopping old $OTHER_COLOR container...${NC}"
if docker ps --format '{{.Names}}' | grep -qx "$OTHER_CONTAINER"; then
    docker stop "$OTHER_CONTAINER" >/dev/null
    echo -e "${GREEN}✓ Stopped $OTHER_CONTAINER (kept as rollback target)${NC}"
else
    echo -e "${YELLOW}No $OTHER_COLOR container running (first deployment)${NC}"
fi

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${GREEN}✓ $CONTAINER is running and healthy${NC}"
echo -e "${GREEN}✓ nginx routes to $DEPLOY_COLOR${NC}"
echo -e "${GREEN}✓ Rollback: docker start $OTHER_CONTAINER && ./deploy-zero-downtime.sh $OTHER_COLOR${NC}"
echo -e "${GREEN}✓ Zero downtime achieved${NC}"

# reclaim_disk, not cleanup_old_images on this repo alone -- see its comment.
echo -e "${YELLOW}Cleaning up old Docker images (keeping newest $KEEP_IMAGES per repo)...${NC}"
reclaim_disk
echo -e "${GREEN}✓ Docker image cleanup complete${NC}"
