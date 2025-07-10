#!/bin/bash

echo "=== Final Docker Rebuild ==="
echo "Fixed conditional vite imports - now building production version"
echo ""

# Stop app container
echo "1. Stopping app container..."
docker compose stop app

# Remove app container and image
echo "2. Removing old app container and image..."
docker compose rm -f app
docker image rm $(docker images "*blabbme*app*" -q) 2>/dev/null || echo "No app images to remove"

# Build with no cache to ensure fresh build
echo "3. Building with conditional vite imports..."
docker compose build --no-cache app

# Start the app
echo "4. Starting fixed app..."
docker compose up -d app

# Show final status
echo "5. Final status..."
docker compose ps

echo ""
echo "=== Final build complete! ==="
echo "The PostgreSQL database is ready with all tables and admin user."
echo "Monitor app startup: docker compose logs -f app"
echo ""
echo "If successful, configure nginx proxy manager:"
echo "- Forward to: localhost:5000"
echo "- Enable WebSocket support"
echo "- Add SSL certificate"