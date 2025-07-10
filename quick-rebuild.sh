#!/bin/bash

echo "=== Quick App Rebuild ==="
echo "Database is working perfectly - just rebuilding the Node.js app"
echo ""

# Stop app container only (keep database running)
echo "1. Stopping app container..."
docker compose stop app

# Remove just the app container
echo "2. Removing app container..."
docker compose rm -f app

# Rebuild just the app
echo "3. Rebuilding app with no-banner build-server.js..."
docker compose build --no-cache app

# Start the app
echo "4. Starting app..."
docker compose up -d app

# Show status
echo "5. Status check..."
docker compose ps

echo ""
echo "=== Quick rebuild complete! ==="
echo "Monitor with: docker compose logs -f app"