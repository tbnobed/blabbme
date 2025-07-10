#!/bin/bash

echo "=== Final Production Rebuild - Zero Vite Dependencies ==="
echo "Using completely isolated production server"

# 1. Stop all containers
echo "1. Stopping all containers..."
docker compose down

# 2. Remove all project images
echo "2. Removing all project images..."
docker image rm blabbme-app:latest 2>/dev/null || true

# 3. Clear Docker build cache
echo "3. Clearing Docker build cache..."
docker builder prune -f

# 4. Verify production files
echo "4. Verifying production files..."
echo "  - server/index-production.ts: $(test -f server/index-production.ts && echo '✓' || echo '✗')"
echo "  - build-server.js: $(test -f build-server.js && echo '✓' || echo '✗')"
echo "  - Dockerfile: $(test -f Dockerfile && echo '✓' || echo '✗')"

# 5. Build fresh containers
echo "5. Building fresh containers..."
docker compose build --no-cache

# 6. Start containers
echo "6. Starting containers..."
docker compose up -d

# 7. Wait for startup
echo "7. Waiting for startup..."
sleep 10

# 8. Check status
echo "8. Checking container status..."
docker compose ps

echo ""
echo "=== Production Rebuild Complete ==="
echo "Check logs: docker compose logs -f"
echo "App should be running on port 5000"
echo "Admin login: admin/admin123"