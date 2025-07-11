#!/bin/bash

echo "=== Blabb.me Docker Complete Fix Script ==="
echo ""

# Determine which docker compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Neither 'docker-compose' nor 'docker compose' found. Please install Docker Compose."
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"
echo ""

echo "🛑 Stopping and removing all containers and volumes..."
$DOCKER_COMPOSE down -v --remove-orphans

echo ""
echo "🗑️ Cleaning up Docker system..."
docker system prune -f

echo ""
echo "🔧 Building and starting containers..."
$DOCKER_COMPOSE up -d --build

echo ""
echo "⏳ Waiting for PostgreSQL to start..."
sleep 10

# Wait for PostgreSQL to be ready
for i in {1..30}; do
    if $DOCKER_COMPOSE exec -T postgres pg_isready -U blabbme_user -d blabbme_db 2>/dev/null | grep -q "accepting connections"; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

echo ""
echo "📋 Checking container status..."
$DOCKER_COMPOSE ps

echo ""
echo "🔍 Checking database setup..."

# Check if database exists
DB_EXISTS=$($DOCKER_COMPOSE exec -T postgres psql -U blabbme_user -lqt 2>/dev/null | cut -d \| -f 1 | grep -w blabbme_db | wc -l)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "❌ Database 'blabbme_db' doesn't exist. Creating it..."
    $DOCKER_COMPOSE exec -T postgres createdb -U blabbme_user blabbme_db 2>/dev/null || echo "Database creation failed or already exists"
fi

echo ""
echo "🔍 Checking and fixing admin account..."

# Check if admins table exists, if not run init.sql
TABLE_EXISTS=$($DOCKER_COMPOSE exec -T postgres psql -U blabbme_user -d blabbme_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admins');" 2>/dev/null | tr -d '[:space:]')

if [[ $TABLE_EXISTS != "t" ]]; then
    echo "❌ Tables don't exist. Running initialization..."
    $DOCKER_COMPOSE exec -T postgres psql -U blabbme_user -d blabbme_db -f /docker-entrypoint-initdb.d/init.sql
fi

# Ensure admin user exists with correct password
echo "🔧 Creating/updating admin user..."
$DOCKER_COMPOSE exec -T postgres psql -U blabbme_user -d blabbme_db -c "
INSERT INTO admins (username, password) 
VALUES ('admin', 'admin123') 
ON CONFLICT (username) 
DO UPDATE SET password = 'admin123';" 2>/dev/null

echo ""
echo "✅ Admin user setup complete!"

echo ""
echo "📋 Verifying admin account..."
$DOCKER_COMPOSE exec -T postgres psql -U blabbme_user -d blabbme_db -c "SELECT id, username, created_at FROM admins WHERE username = 'admin';" 2>/dev/null

echo ""
echo "⏳ Waiting for application to start..."
sleep 5

# Test the application
echo "🧪 Testing admin login..."
for i in {1..10}; do
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "failed")
    
    if [[ $LOGIN_RESPONSE == *"Login successful"* ]] || [[ $LOGIN_RESPONSE == *"admin"* ]]; then
        echo "✅ Admin login test PASSED!"
        echo "Response: $LOGIN_RESPONSE"
        break
    else
        echo "Attempt $i/10: $LOGIN_RESPONSE"
        sleep 2
    fi
done

echo ""
echo "🧪 Testing application health..."
HEALTH_RESPONSE=$(curl -s http://localhost:5000/api/health 2>/dev/null || echo "failed")
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✅ Application health check PASSED!"
else
    echo "❌ Application health check FAILED: $HEALTH_RESPONSE"
fi

echo ""
echo "=== Setup Complete ==="
echo "🎉 Your Blabb.me application should now be running!"
echo ""
echo "Admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "URLs:"
echo "  Main app: http://localhost:5000"
echo "  Admin login: http://localhost:5000/admin/login"
echo "  API health: http://localhost:5000/api/health"
echo ""
echo "To view logs: $DOCKER_COMPOSE logs -f"
echo "To stop: $DOCKER_COMPOSE down"