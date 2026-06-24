#!/bin/bash

# Blue/Green Deployment Script for Kyklos Backend
# This script achieves zero-downtime deployment

set -e

# Configuration
PROJECT_NAME="kyklos-backend"
BLUE_CONTAINER="${PROJECT_NAME}-blue"
GREEN_CONTAINER="${PROJECT_NAME}-green"
NGINX_CONTAINER="kyklos-nginx"
HEALTH_CHECK_URL="http://localhost:5000/health"
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if container exists and is running
is_container_running() {
    local container_name=$1
    if docker ps -q -f name="$container_name" | grep -q .; then
        return 0
    else
        return 1
    fi
}

# Function to get current active environment
get_active_environment() {
    if is_container_running "$BLUE_CONTAINER"; then
        echo "blue"
    elif is_container_running "$GREEN_CONTAINER"; then
        echo "green"
    else
        echo "none"
    fi
}

# Function to wait for health check
wait_for_health_check() {
    local container_name=$1
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=1
    
    log_info "Waiting for $container_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker exec "$container_name" curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "$container_name is healthy!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Waiting for health check..."
        sleep $HEALTH_CHECK_INTERVAL
        ((attempt++))
    done
    
    log_error "$container_name failed health check after $HEALTH_CHECK_TIMEOUT seconds"
    return 1
}

# Function to update nginx configuration
update_nginx() {
    local active_env=$1
    
    log_info "Updating nginx to route to $active_env environment..."
    
    # Create nginx config file
    cat > nginx/conf.d/upstream.conf << EOF
upstream kyklos_backend {
    server kyklos-backend-${active_env}:5000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://kyklos_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

    # Reload nginx
    docker exec "$NGINX_CONTAINER" nginx -s reload
    log_success "Nginx configuration updated and reloaded"
}

# Function to deploy new version
deploy() {
    log_info "Starting blue/green deployment..."
    
    # Get current active environment
    local current_env=$(get_active_environment)
    log_info "Current active environment: $current_env"
    
    # Determine target environment
    local target_env="green"
    if [ "$current_env" = "green" ]; then
        target_env="blue"
    fi
    
    log_info "Target environment for deployment: $target_env"
    
    # Build and start new container
    log_info "Building new container for $target_env environment..."
    docker-compose build "$PROJECT_NAME-$target_env"
    
    log_info "Starting $target_env container..."
    docker-compose up -d "$PROJECT_NAME-$target_env"
    
    # Wait for health check
    if ! wait_for_health_check "$PROJECT_NAME-$target_env"; then
        log_error "Health check failed for $target_env container. Rolling back..."
        docker-compose stop "$PROJECT_NAME-$target_env"
        exit 1
    fi
    
    # Update nginx to route to new environment
    update_nginx "$target_env"
    
    # Stop old environment
    if [ "$current_env" != "none" ]; then
        log_info "Stopping old environment: $current_env"
        docker-compose stop "$PROJECT_NAME-$current_env"
    fi
    
    log_success "Deployment completed successfully! Active environment: $target_env"
}

# Function to rollback
rollback() {
    log_info "Starting rollback..."
    
    local current_env=$(get_active_environment)
    local rollback_env="blue"
    
    if [ "$current_env" = "blue" ]; then
        rollback_env="green"
    fi
    
    log_info "Rolling back to $rollback_env environment..."
    
    # Start rollback environment
    docker-compose up -d "$PROJECT_NAME-$rollback_env"
    
    # Wait for health check
    if ! wait_for_health_check "$PROJECT_NAME-$rollback_env"; then
        log_error "Rollback failed! $rollback_env environment is not healthy."
        exit 1
    fi
    
    # Update nginx
    update_nginx "$rollback_env"
    
    # Stop failed environment
    docker-compose stop "$PROJECT_NAME-$current_env"
    
    log_success "Rollback completed! Active environment: $rollback_env"
}

# Function to show status
status() {
    echo "=== Kyklos Backend Deployment Status ==="
    
    local blue_status="Stopped"
    local green_status="Stopped"
    
    if is_container_running "$BLUE_CONTAINER"; then
        blue_status="Running"
    fi
    
    if is_container_running "$GREEN_CONTAINER"; then
        green_status="Running"
    fi
    
    echo "Blue Container: $blue_status"
    echo "Green Container: $green_status"
    echo "Active Environment: $(get_active_environment)"
    
    echo ""
    echo "=== Container Health ==="
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=kyklos"
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        rollback
        ;;
    "status")
        status
        ;;
    "health")
        local env=$(get_active_environment)
        if [ "$env" != "none" ]; then
            wait_for_health_check "$PROJECT_NAME-$env"
        else
            log_error "No active environment found"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|health}"
        echo "  deploy   - Deploy new version with zero downtime"
        echo "  rollback - Rollback to previous version"
        echo "  status   - Show deployment status"
        echo "  health   - Check health of active environment"
        exit 1
        ;;
esac
