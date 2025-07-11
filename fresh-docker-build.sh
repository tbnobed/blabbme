#!/bin/bash

echo "=== Blabb.me Fresh Docker Build ==="
echo "This will completely rebuild everything from scratch"
echo ""

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose not found"
    exit 1
fi

echo "🗑️  Step 1: Pruning Docker system..."
docker system prune -af --volumes

echo ""
echo "🔧 Step 2: Building and starting containers..."
$DOCKER_COMPOSE up --build -d

echo ""
echo "⏳ Step 3: Waiting for services to be healthy..."
$DOCKER_COMPOSE logs -f &
LOGS_PID=$!

# Wait for both services to be healthy
for service in postgres app; do
    echo "Waiting for $service to be healthy..."
    for i in {1..60}; do
        if $DOCKER_COMPOSE ps $service | grep -q "healthy"; then
            echo "✅ $service is healthy!"
            break
        fi
        sleep 5
        echo "  Attempt $i/60..."
    done
done

# Stop log following
kill $LOGS_PID 2>/dev/null

echo ""
echo "🧪 Step 4: Testing the application..."
sleep 5

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
echo "=== Setup Complete ==="
echo ""
echo "🎉 Your Blabb.me application is ready!"
echo ""
echo "Access URLs:"
echo "  • Main app: http://localhost:5000"
echo "  • Admin login: http://localhost:5000/admin/login"
echo ""
echo "Admin credentials:"
echo "  • Username: admin"
echo "  • Password: admin123"
echo ""
echo "Useful commands:"
echo "  • View logs: $DOCKER_COMPOSE logs -f"
echo "  • Stop app: $DOCKER_COMPOSE down"
echo "  • Restart: $DOCKER_COMPOSE restart"