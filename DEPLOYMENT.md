# Blue-Green Deployment Guide

This guide covers the Docker-based blue-green deployment setup for the Kyklos backend with in-house MongoDB and Redis.

## Architecture

- **Blue/Green Environments**: Two identical production environments running simultaneously
- **Nginx Reverse Proxy**: Routes traffic to the active environment
- **In-house MongoDB**: Local MongoDB instance (cloned from production Atlas)
- **In-house Redis**: Local Redis instance for caching
- **Shared File Storage**: Docker volume for persistent file uploads (PDFs, images, etc.)
- **Zero Downtime**: Switch traffic between environments without downtime

## Prerequisites

- Docker and Docker Compose installed on the server
- GitHub repository with Actions enabled
- SSH access to the production server
- Domain configured with SSL certificates

## Initial Setup

### 1. Configure Environment Variables

Edit `.env.docker` with your production values:

```bash
# Update these values
MONGO_PASSWORD=your-strong-mongo-password
REDIS_PASSWORD=your-strong-redis-password
JWT_SECRET=your-super-secret-jwt-key
```

### 2. Clone Production Database

Clone MongoDB Atlas to local instance:

```bash
# Ensure MongoDB container is running
docker-compose up -d mongodb

# Run the clone script
SOURCE_MONGODB_URI="mongodb+srv://user:pass@cluster/db" \
TARGET_MONGODB_URI="mongodb://admin:password@localhost:27017/kyklos_db?authSource=admin" \
node scripts/clone-mongodb.js
```

### 3. Start Infrastructure

Start MongoDB, Redis, and Nginx:

```bash
docker-compose up -d mongodb redis nginx
```

### 4. Configure GitHub Secrets

Add these secrets to your GitHub repository:

- `PRODUCTION_HOST`: Server IP address
- `PRODUCTION_USER`: SSH username (e.g., root)
- `SSH_PRIVATE_KEY`: Private SSH key for server access

### 5. Configure Nginx

Update `nginx/conf.d/kyklos.conf`:

```bash
# Replace your-domain.com with your actual domain
sed -i 's/your-domain.com/api.yourdomain.com/g' nginx/conf.d/kyklos.conf

# Set initial active backend
sed -i 's/ACTIVE_BACKEND/blue/g' nginx/conf.d/kyklos.conf
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

Push to `main` branch to trigger automatic blue-green deployment:

1. Build and push Docker image
2. Deploy to green environment
3. Run health checks
4. Switch traffic to green
5. Cleanup blue environment
6. Automatic rollback on failure

### Method 2: Manual Deployment

#### Deploy to Green Environment

```bash
# Build and push image manually
docker build -t kyklos-backend:latest .
docker tag kyklos-backend:latest ghcr.io/your-org/kyklos-backend:latest
docker push ghcr.io/your-org/kyklos-backend:latest

# Deploy to green
./scripts/deploy-blue-green.sh green latest
```

#### Switch Traffic to Green

```bash
./scripts/switch-blue-green.sh green
```

#### Switch Back to Blue (Rollback)

```bash
./scripts/switch-blue-green.sh blue
```

## Deployment Scripts

### `scripts/deploy-blue-green.sh`

Deploys a new version to a specific environment (blue or green).

```bash
./scripts/deploy-blue-green.sh [blue|green] [image-tag]
```

**Process:**
1. Pulls the specified Docker image
2. Stops the existing container for that environment
3. Starts a new container with the updated image
4. Waits for health check to pass
5. Reports success/failure

### `scripts/switch-blue-green.sh`

Switches nginx traffic between blue and green environments.

```bash
./scripts/switch-blue-green.sh [blue|green]
```

**Process:**
1. Backs up current nginx configuration
2. Checks health of target container
3. Updates nginx configuration to route to target
4. Tests nginx configuration
5. Reloads nginx
6. Verifies health check
7. Automatic rollback on failure

### `scripts/clone-mongodb.js`

Clones production MongoDB Atlas to local instance.

```bash
SOURCE_MONGODB_URI="production-uri" \
TARGET_MONGODB_URI="local-uri" \
node scripts/clone-mongodb.js
```

## Docker Compose Services

### kyklos-backend-blue
Blue environment container (current production)

### kyklos-backend-green
Green environment container (new version)

### nginx
Reverse proxy for routing traffic

### mongodb
In-house MongoDB instance

### redis
In-house Redis instance

## Monitoring

### Check Container Status

```bash
# Check all containers
docker-compose ps

# Check specific container health
docker inspect --format='{{.State.Health.Status}}' kyklos-backend-blue
docker inspect --format='{{.State.Health.Status}}' kyklos-backend-green
```

### View Logs

```bash
# Blue environment logs
docker logs -f kyklos-backend-blue

# Green environment logs
docker logs -f kyklos-backend-green

# Nginx logs
docker logs -f kyklos-nginx

# MongoDB logs
docker logs -f kyklos-mongodb

# Redis logs
docker logs -f kyklos-redis
```

### Health Check

```bash
# Check backend health
curl http://localhost/health

# Check specific environment
curl http://localhost:5000/health
```

## Troubleshooting

### Container Not Healthy

```bash
# View logs
docker logs kyklos-backend-blue --tail 100

# Restart container
docker restart kyklos-backend-blue

# Rebuild container
docker-compose up -d --build kyklos-backend-blue
```

### Nginx Configuration Error

```bash
# Test configuration
docker exec kyklos-nginx nginx -t

# Restore backup
cp nginx/conf.d/kyklos.conf.backup nginx/conf.d/kyklos.conf
docker exec kyklos-nginx nginx -s reload
```

### Database Connection Issues

```bash
# Check MongoDB status
docker exec kyklos-mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis status
docker exec kyklos-redis redis-cli ping

# Restart database services
docker-compose restart mongodb redis
```

### Rollback Procedure

If deployment fails:

```bash
# Switch back to blue
./scripts/switch-blue-green.sh blue

# Stop green container
docker stop kyklos-backend-green
docker rm kyklos-backend-green

# Check logs for errors
docker logs kyklos-backend-green --tail 100
```

## Security Considerations

1. **Strong Passwords**: Use strong passwords for MongoDB and Redis
2. **SSL/TLS**: Ensure SSL certificates are properly configured
3. **Network Isolation**: Services run on isolated Docker network
4. **Secrets Management**: Use GitHub Secrets for sensitive data
5. **Regular Updates**: Keep Docker images and dependencies updated

## File Storage

The application stores uploaded files (PDFs, images, etc.) in the `public` directory. In the Docker setup:

- **Shared Volume**: Both blue and green containers share the `public-files` Docker volume
- **Persistent Storage**: Files persist across container restarts and deployments
- **Location**: Mounted at `/app/public` in containers

### Migrating Existing Files from PM2

If migrating from the existing PM2 setup:

```bash
# 1. Stop the PM2 service on the server
ssh root@194.99.21.157 "pm2 stop kyklos-backend"

# 2. Copy existing files from PM2 directory to Docker volume
ssh root@194.99.21.157 "docker run --rm -v kyklos-backend_public-files:/data -v /root/kyklos-backend/public:/source alpine sh -c 'cp -r /source/* /data/'"

# 3. Verify files are in the volume
ssh root@194.99.21.157 "docker run --rm -v kyklos-backend_public-files:/data alpine ls -la /data"

# 4. Start Docker containers
ssh root@194.99.21.157 "cd /root/kyklos-backend && docker-compose up -d"
```

### Backup File Storage

```bash
# Backup public files volume
docker run --rm -v kyklos-backend_public-files:/data -v $(pwd)/backups:/backup alpine tar czf /backup/public-files-$(date +%Y%m%d).tar.gz -C /data .

# Restore public files volume
docker run --rm -v kyklos-backend_public-files:/data -v $(pwd)/backups:/backup alpine tar xzf /backup/public-files-20240624.tar.gz -C /data
```

### File Storage Structure

```
public/
├── panhellenic-archive/    # Panhellenic exam files (PDFs)
├── math/                   # Math materials
├── physics/                # Physics materials
└── ...                     # Other subject materials
```

## Backup Strategy

### MongoDB Backup

```bash
# Create backup
docker exec kyklos-mongodb mongodump --archive=/data/backup/kyklos-$(date +%Y%m%d).archive

# Restore backup
docker exec kyklos-mongodb mongorestore --archive=/data/backup/kyklos-20240624.archive
```

### Redis Backup

```bash
# Create backup
docker exec kyklos-redis redis-cli BGSAVE

# Copy RDB file
docker cp kyklos-redis:/data/dump.rdb ./backups/
```

## Performance Optimization

- **MongoDB**: Configure WiredTiger cache size based on available RAM
- **Redis**: Enable persistence with AOF for durability
- **Nginx**: Adjust worker processes based on CPU cores
- **Application**: Use connection pooling for database connections

## Scaling

To scale horizontally:

1. Add multiple instances behind nginx load balancer
2. Configure nginx upstream with multiple servers
3. Use shared storage for file uploads
4. Configure session storage in Redis

## Support

For issues or questions:
- Check container logs
- Review GitHub Actions workflow runs
- Verify environment variables
- Test database connectivity
