#!/bin/bash

echo "=== Quick Fix - Database Constraint Issue ==="

# Stop containers
docker compose down

# Remove app image
docker image rm blabbme-app:latest 2>/dev/null || true

# Quick rebuild 
echo "Rebuilding with database constraint fix..."
docker compose build --no-cache app

# Start containers
docker compose up -d

echo "Waiting for startup..."
sleep 8

echo ""
echo "=== Testing Join Room Functionality ==="
docker compose logs app | tail -10