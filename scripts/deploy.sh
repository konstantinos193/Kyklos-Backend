#!/bin/bash

# Simple deployment script for Kyklos Backend
# Builds and deploys the application to VPS

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
VPS_HOST="root@194.99.21.157"
VPS_DIR="/root/kyklos-backend"

log "Starting deployment to VPS..."

# Build Docker image locally
log "Building Docker image..."
docker build -t kyklos-backend:latest .

if [ $? -eq 0 ]; then
    log_success "Docker image built successfully"
else
    log_error "Docker image build failed"
    exit 1
fi

# Save image to tar
log "Saving Docker image..."
docker save kyklos-backend:latest | gzip > kyklos-backend.tar.gz

# Transfer to VPS
log "Transferring image to VPS..."
scp kyklos-backend.tar.gz $VPS_HOST:/tmp/

# Load image on VPS
log "Loading image on VPS..."
ssh $VPS_HOST "docker load < /tmp/kyklos-backend.tar.gz"

# Transfer docker-compose.yml and .env.docker
log "Transferring configuration files..."
scp docker-compose.yml $VPS_HOST:$VPS_DIR/
scp .env.docker $VPS_HOST:$VPS_DIR/
scp nginx/nginx.conf $VPS_HOST:$VPS_DIR/nginx/
scp nginx/conf.d/kyklos.conf $VPS_HOST:$VPS_DIR/nginx/conf.d/

# Stop existing container
log "Stopping existing container..."
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker down kyklos-backend || true"

# Start new container
log "Starting new container..."
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker up -d kyklos-backend"

# Restart nginx
log "Restarting nginx..."
ssh $VPS_HOST "cd $VPS_DIR && docker compose --env-file .env.docker restart nginx"

# Cleanup
log "Cleaning up..."
rm kyklos-backend.tar.gz
ssh $VPS_HOST "rm /tmp/kyklos-backend.tar.gz"

log_success "Deployment completed successfully!"
