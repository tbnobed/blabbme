#!/bin/bash

echo "=== Quick Frontend Path Fix ==="
echo "Rebuilding with intelligent path detection"

# Stop containers
docker compose down

# Remove only the app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Build only the app service
docker compose build --no-cache app

# Start containers
docker compose up -d

echo "Frontend path fix deployed!"
echo "Check logs: docker compose logs -f app"