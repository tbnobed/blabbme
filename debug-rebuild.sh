#!/bin/bash

echo "=== Debug Rebuild - Inspect File Structure ==="

# Stop containers
docker compose down

# Remove only the app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Build with debug info
docker compose build --no-cache app

# Start containers
docker compose up -d

echo ""
echo "Containers started. Waiting 5 seconds for startup..."
sleep 5

echo ""
echo "=== Server logs should show directory contents ==="
docker compose logs app