#!/bin/bash

# Script to update .env.docker on production server and restart containers

set -e

echo "🔄 Updating .env.docker on production server..."

# Copy the updated .env.docker to production server
scp .env.docker root@194.99.21.157:/root/kyklos-backend/

echo "✅ .env.docker copied to production server"

# SSH into production and restart containers
ssh root@194.99.21.157 << 'ENDSSH'
cd /root/kyklos-backend

echo "🔄 Restarting backend containers with new configuration..."
docker-compose --env-file .env.docker restart kyklos-backend-blue kyklos-backend-green

echo "✅ Containers restarted"
ENDSSH

echo "✅ Deployment complete! The API should now return panhellenic archive data."
