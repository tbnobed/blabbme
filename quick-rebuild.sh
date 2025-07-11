#!/bin/bash

echo "=== Quick Docker Rebuild ==="

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose not found"
    exit 1
fi

echo "🔧 Rebuilding app container..."
$DOCKER_COMPOSE build app

echo "🔄 Restarting app service..."
$DOCKER_COMPOSE up -d app

echo "⏳ Waiting for app to start..."
sleep 10

echo "🧪 Testing application..."
# Test health endpoint
HEALTH=$(curl -s http://localhost:5000/api/health 2>/dev/null || echo "failed")
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Health check: PASSED"
else
    echo "❌ Health check: FAILED ($HEALTH)"
fi

# Test admin login
LOGIN=$(curl -s -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "failed")

if [[ $LOGIN == *"Login successful"* ]] || [[ $LOGIN == *"admin"* ]]; then
    echo "✅ Admin login: PASSED"
else
    echo "❌ Admin login: FAILED ($LOGIN)"
fi

echo ""
echo "App logs:"
$DOCKER_COMPOSE logs --tail=20 app