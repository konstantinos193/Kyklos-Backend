#!/bin/bash

# Simple Blue-Green Deployment Script
# Fast deployment without GitHub Actions complexity

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
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

# Configuration
VPS_HOST="root@194.99.21.157"
VPS_DIR="/root/kyklos-backend"
IMAGE_NAME="kyklos-backend"

log "Starting blue-green deployment to VPS..."

# Build Docker image locally
log "Building Docker image..."
docker build -t $IMAGE_NAME:latest .

if [ $? -eq 0 ]; then
    log_success "Docker image built successfully"
else
    log_error "Docker image build failed"
    exit 1
fi

# Save image to tar
log "Saving Docker image..."
docker save $IMAGE_NAME:latest | gzip > $IMAGE_NAME.tar.gz

# Transfer to VPS
log "Transferring image to VPS..."
scp $IMAGE_NAME.tar.gz $VPS_HOST:/tmp/

# Load image on VPS
log "Loading image on VPS..."
ssh $VPS_HOST "docker load < /tmp/$IMAGE_NAME.tar.gz"

# Transfer docker-compose.yml and .env.docker
log "Transferring configuration files..."
scp docker-compose.yml $VPS_HOST:$VPS_DIR/
scp .env.docker $VPS_HOST:$VPS_DIR/
scp nginx/nginx.conf $VPS_HOST:$VPS_DIR/nginx/
scp nginx/conf.d/kyklos.conf $VPS_HOST:$VPS_DIR/nginx/conf.d/

# Deploy to green environment
log "Deploying to green environment..."
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker stop kyklos-backend-green || true"
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker rm -f kyklos-backend-green || true"
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker up -d kyklos-backend-green"

# Wait for green to be healthy
log "Waiting for green environment to be healthy..."
ssh $VPS_HOST "timeout 120 bash -c 'until docker inspect --format=\"{{.State.Health.Status}}\" kyklos-backend-green | grep -q \"healthy\"; do sleep 5; done'"

if [ $? -eq 0 ]; then
    log_success "Green environment is healthy"
else
    log_error "Green environment failed health check"
    exit 1
fi

# Switch traffic to green
log "Switching traffic to green..."
ssh $VPS_HOST "sed -i 's/kyklos-backend-ACTIVE_BACKEND/kyklos-backend-green/g' $VPS_DIR/nginx/conf.d/kyklos.conf"
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker restart nginx"

# Wait for nginx to reload
sleep 5

# Verify green is serving traffic
log "Verifying green is serving traffic..."
ssh $VPS_HOST "curl -f http://localhost/health || exit 1"

if [ $? -eq 0 ]; then
    log_success "Green environment is serving traffic"
else
    log_error "Green environment health check failed, rolling back..."
    ssh $VPS_HOST "sed -i 's/kyklos-backend-green/kyklos-backend-blue/g' $VPS_DIR/nginx/conf.d/kyklos.conf"
    ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker restart nginx"
    exit 1
fi

# Cleanup blue environment
log "Cleaning up blue environment..."
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker stop kyklos-backend-blue || true"
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker rm -f kyklos-backend-blue || true"

# Cleanup local files
log "Cleaning up local files..."
rm $IMAGE_NAME.tar.gz
ssh $VPS_HOST "rm /tmp/$IMAGE_NAME.tar.gz"

log_success "Blue-green deployment completed successfully!"
log "Traffic is now routed to green environment"
