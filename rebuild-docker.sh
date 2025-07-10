#!/bin/bash

echo "=== Complete Docker Rebuild Script ==="
echo "This will clear all Docker cache and rebuild from scratch"
echo ""

# Stop all containers
echo "1. Stopping all containers..."
docker compose down

# Remove old containers and images
echo "2. Removing old containers and images..."
docker system prune --all --force --volumes

# Remove any existing images specifically for this project
echo "3. Removing project-specific images..."
docker image rm $(docker images "*blabbme*" -q) 2>/dev/null || echo "No blabbme images found"

# Verify critical files exist
echo "4. Verifying critical files..."
if [ ! -f "Dockerfile" ]; then
    echo "ERROR: Dockerfile not found!"
    exit 1
fi

if [ ! -f "build-server.js" ]; then
    echo "ERROR: build-server.js not found!"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.example to .env and set your passwords"
    exit 1
fi

# Show the current Docker build command
echo "5. Current Docker build command:"
grep -n "RUN.*vite" Dockerfile

# Build with no cache
echo "6. Building with no cache (this may take several minutes)..."
docker compose build --no-cache

# Start services
echo "7. Starting services..."
docker compose up -d

# Show status
echo "8. Checking status..."
docker compose ps

echo ""
echo "=== Build complete! ==="
echo "Monitor logs with: docker compose logs -f app"
echo "Check status with: docker compose ps"