#!/bin/bash

echo "=== Final Fix - Frontend Build Process ==="

# Stop containers
docker compose down

# Remove app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Build with verbose output to see frontend build
echo "Building with frontend verification..."
docker compose build --no-cache app

# Start containers
docker compose up -d

echo ""
echo "Build complete! Checking startup..."
sleep 5

echo ""
echo "=== Application Status ==="
docker compose logs app | tail -10