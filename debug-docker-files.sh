#!/bin/bash

echo "=== Debug Docker Container Files ==="

echo "1. Checking if app container is running..."
docker compose ps

echo ""
echo "2. Listing files in /app/dist directory..."
docker compose exec app ls -la /app/dist/

echo ""
echo "3. Checking if public directory exists..."
docker compose exec app ls -la /app/dist/public/ 2>/dev/null || echo "public directory not found"

echo ""
echo "4. Finding all index.html files..."
docker compose exec app find /app -name "index.html" 2>/dev/null || echo "No index.html found"

echo ""
echo "5. Listing all files in /app directory..."
docker compose exec app find /app -type f | head -20