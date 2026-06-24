#!/bin/bash

# Blue-Green Deployment Script
# Usage: ./scripts/deploy-blue-green.sh [blue|green]

set -e

TARGET_COLOR=${1:-green}
IMAGE_TAG=${2:-latest}
REGISTRY="ghcr.io"
IMAGE_NAME="${REGISTRY}/$(git config --get remote.origin.url | sed -e 's/https:\/\/github.com\///' -e 's/\.git$//')/kyklos-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

# Validate color argument
if [[ "$TARGET_COLOR" != "blue" && "$TARGET_COLOR" != "green" ]]; then
    log_error "Invalid color. Use 'blue' or 'green'"
    exit 1
fi

log "Starting deployment to ${TARGET_COLOR} environment..."
log "Image: ${IMAGE_NAME}:${IMAGE_TAG}"

# Pull latest image
log "Pulling Docker image..."
docker pull "${IMAGE_NAME}:${IMAGE_TAG}"

# Stop existing container if running
log "Stopping existing ${TARGET_COLOR} container..."
docker stop "kyklos-backend-${TARGET_COLOR}" 2>/dev/null || true
docker rm "kyklos-backend-${TARGET_COLOR}" 2>/dev/null || true

# Start new container
log "Starting new ${TARGET_COLOR} container..."
docker run -d \
    --name "kyklos-backend-${TARGET_COLOR}" \
    --network kyklos-network \
    --env-file .env.production \
    -e NODE_ENV=production \
    -e PORT=5000 \
    -e MONGODB_URI="mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@mongodb:27017/kyklos_db?authSource=admin" \
    -e REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379" \
    -e UPSTASH_REDIS_REST_URL="redis://:${REDIS_PASSWORD}@redis:6379" \
    --label deployment.color="${TARGET_COLOR}" \
    --restart unless-stopped \
    "${IMAGE_NAME}:${IMAGE_TAG}"

log_success "Container started"

# Wait for health check
log "Waiting for container to be healthy..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "kyklos-backend-${TARGET_COLOR}" 2>/dev/null || echo "none")
    if [ "$HEALTH" = "healthy" ]; then
        log_success "Container is healthy"
        break
    elif [ "$HEALTH" = "unhealthy" ]; then
        log_error "Container is unhealthy"
        docker logs "kyklos-backend-${TARGET_COLOR}" --tail 50
        exit 1
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -n "."
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    log_error "Container did not become healthy within ${TIMEOUT}s"
    docker logs "kyklos-backend-${TARGET_COLOR}" --tail 50
    exit 1
fi

log_success "Deployment to ${TARGET_COLOR} completed successfully"
log "Run './scripts/switch-blue-green.sh ${TARGET_COLOR}' to switch traffic"
