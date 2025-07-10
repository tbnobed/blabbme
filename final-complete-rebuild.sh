#!/bin/bash

echo "=== Final Complete Rebuild - Fixed Build Process ==="

# Stop containers
docker compose down

# Remove all blabbme related images
docker image rm blabbme-app:latest 2>/dev/null || true
docker image prune -f

# Clear build cache completely
docker builder prune -a -f

echo "Building with corrected Dockerfile..."
docker compose build --no-cache --progress=plain app

echo "Starting containers..."
docker compose up -d

echo "Waiting for startup..."
sleep 10

echo ""
echo "=== Application Status ==="
docker compose ps

echo ""
echo "=== Build Verification Logs ==="
docker compose logs app | grep -E "(Debug|Frontend|Production|dist|public|===|✓|✗)"

echo ""
echo "=== Current Server Status ==="
docker compose logs app | tail -5