#!/bin/bash

echo "=== Production Rebuild - Database Fix ==="

# Stop containers
docker compose down

# Remove app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Rebuild app with database fixes
echo "Rebuilding with PostgreSQL driver fix..."
docker compose build --no-cache app

# Start containers
docker compose up -d

echo "Waiting for startup..."
sleep 10

echo ""
echo "=== Application Status ==="
docker compose ps

echo ""
echo "=== Database Connection Check ==="
docker compose logs app | grep -E "(database|postgres|Database|Production|frontend)" | tail -10

echo ""
echo "=== Latest Server Status ==="
docker compose logs app | tail -5