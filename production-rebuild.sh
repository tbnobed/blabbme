#!/bin/bash

echo "=== Production Rebuild - No Vite Dependencies ==="
echo "Using production-only static file server"
echo ""

# Stop and clean everything
echo "1. Stopping all containers..."
docker compose down

# Remove all blabbme images
echo "2. Removing all project images..."
docker image rm $(docker images "*blabbme*" -q) 2>/dev/null || echo "No images to remove"

# Clear all build cache
echo "3. Clearing Docker build cache..."
docker builder prune --all --force

# Verify files exist
echo "4. Verifying production files..."
echo "  - server/vite-production.ts: $([ -f server/vite-production.ts ] && echo "✓" || echo "✗")"
echo "  - build-server.js: $([ -f build-server.js ] && echo "✓" || echo "✗")"
echo "  - Dockerfile: $([ -f Dockerfile ] && echo "✓" || echo "✗")"

# Build completely fresh
echo "5. Building fresh containers..."
docker compose build --no-cache

# Start services
echo "6. Starting services..."
docker compose up -d

# Monitor startup
echo "7. Monitoring startup..."
sleep 5
docker compose ps

echo ""
echo "=== Production build complete! ==="
echo ""
echo "Database status:"
docker compose exec postgres psql -U blabbme_user -d blabbme -c "SELECT 'Admin user exists: ' || CASE WHEN EXISTS(SELECT 1 FROM admins WHERE username='admin') THEN 'YES' ELSE 'NO' END;"

echo ""
echo "Application status:"
echo "Monitor logs: docker compose logs -f app"
echo "If successful, your app will be at: http://localhost:5000"
echo ""
echo "For Nginx Proxy Manager:"
echo "- Forward to: blabbme-app-1:5000 (or localhost:5000)"
echo "- Enable WebSocket support"
echo "- Add SSL certificate"