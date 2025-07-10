#!/bin/bash

echo "=== Correct Build Process - Using Vite Config ==="

# Stop containers
docker compose down

# Remove app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Build with correct vite command
echo "Building with default vite configuration..."
docker compose build --no-cache app

# Start containers
docker compose up -d

echo ""
echo "Build complete! Waiting for startup..."
sleep 10

echo ""
echo "=== Server Status ==="
docker compose logs app | grep -E "(Debug|Frontend|Production|dist|public|index.html)"