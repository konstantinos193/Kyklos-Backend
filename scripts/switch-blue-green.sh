#!/bin/bash

# Blue-Green Deployment Switch Script
# Usage: ./scripts/switch-blue-green.sh [blue|green]

set -e

COLOR=${1:-blue}
NGINX_CONF="nginx/conf.d/kyklos.conf"
BACKUP_CONF="nginx/conf.d/kyklos.conf.backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
if [[ "$COLOR" != "blue" && "$COLOR" != "green" ]]; then
    log_error "Invalid color. Use 'blue' or 'green'"
    exit 1
fi

log "Starting switch to ${COLOR} environment..."

# Backup current nginx config
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "$BACKUP_CONF"
    log "Backed up current nginx configuration"
fi

# Determine opposite color
if [ "$COLOR" = "blue" ]; then
    OPPOSITE="green"
else
    OPPOSITE="blue"
fi

# Check if target container exists and is healthy
log "Checking health of kyklos-backend-${COLOR} container..."
if ! docker ps --format '{{.Names}}' | grep -q "kyklos-backend-${COLOR}"; then
    log_error "Container kyklos-backend-${COLOR} is not running"
    exit 1
fi

# Wait for container to be healthy
log "Waiting for container to be healthy..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "kyklos-backend-${COLOR}" 2>/dev/null || echo "none")
    if [ "$HEALTH" = "healthy" ]; then
        log_success "Container is healthy"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    log_error "Container did not become healthy within ${TIMEOUT}s"
    exit 1
fi

# Update nginx configuration
log "Updating nginx configuration to route to ${COLOR}..."
sed -i "s/kyklos-backend-${OPPOSITE}/kyklos-backend-${COLOR}/g" "$NGINX_CONF"

# Test nginx configuration
log "Testing nginx configuration..."
docker exec kyklos-nginx nginx -t
if [ $? -ne 0 ]; then
    log_error "Nginx configuration test failed"
    # Restore backup
    if [ -f "$BACKUP_CONF" ]; then
        cp "$BACKUP_CONF" "$NGINX_CONF"
        log "Restored backup configuration"
    fi
    exit 1
fi

# Reload nginx
log "Reloading nginx..."
docker exec kyklos-nginx nginx -s reload
log_success "Nginx reloaded successfully"

# Verify the switch
log "Verifying switch..."
sleep 5
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH_CHECK" = "200" ]; then
    log_success "Health check passed (HTTP $HEALTH_CHECK)"
else
    log_error "Health check failed (HTTP $HEALTH_CHECK)"
    # Rollback
    log "Rolling back to ${OPPOSITE}..."
    sed -i "s/kyklos-backend-${COLOR}/kyklos-backend-${OPPOSITE}/g" "$NGINX_CONF"
    docker exec kyklos-nginx nginx -s reload
    log_error "Rolled back to ${OPPOSITE}"
    exit 1
fi

log_success "Successfully switched to ${COLOR} environment"

# Optional: Stop the old environment after a delay
read -p "Stop ${OPPOSITE} environment? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Stopping ${OPPOSITE} environment..."
    docker stop "kyklos-backend-${OPPOSITE}" || true
    docker rm "kyklos-backend-${OPPOSITE}" || true
    log_success "Stopped ${OPPOSITE} environment"
fi

log "Deployment switch completed"
