#!/bin/bash

echo "=== Blabb.me Docker Admin Account Verification ==="
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

# Check if containers are running
echo "📋 Checking container status..."
$DOCKER_COMPOSE ps

echo ""
echo "🔍 Checking PostgreSQL connection..."
POSTGRES_STATUS=$(docker-compose exec -T postgres pg_isready -U blabbme_user -d blabbme_db 2>/dev/null || echo "failed")

if [[ $POSTGRES_STATUS == *"accepting connections"* ]]; then
    echo "✅ PostgreSQL is running and accepting connections"
else
    echo "❌ PostgreSQL is not ready. Container may be starting up."
    echo "Please wait a moment and try again."
    exit 1
fi

echo ""
echo "🔍 Checking admin table and user..."

# Check if admins table exists
TABLE_EXISTS=$(docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admins');" 2>/dev/null | tr -d '[:space:]')

if [[ $TABLE_EXISTS == "t" ]]; then
    echo "✅ Admins table exists"
    
    # Check admin user
    echo ""
    echo "📋 Current admin users:"
    docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -c "SELECT id, username, created_at FROM admins;" 2>/dev/null
    
    # Check specific admin user
    ADMIN_EXISTS=$(docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -t -c "SELECT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');" 2>/dev/null | tr -d '[:space:]')
    
    if [[ $ADMIN_EXISTS == "t" ]]; then
        echo ""
        echo "✅ Default admin user exists"
        
        # Get the password to verify it's correct
        ADMIN_PASSWORD=$(docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -t -c "SELECT password FROM admins WHERE username = 'admin';" 2>/dev/null | tr -d '[:space:]')
        
        if [[ $ADMIN_PASSWORD == "admin123" ]]; then
            echo "✅ Admin password is correctly set to 'admin123'"
        else
            echo "❌ Admin password is: '$ADMIN_PASSWORD' (should be 'admin123')"
            echo ""
            echo "🔧 Fixing admin password..."
            docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -c "UPDATE admins SET password = 'admin123' WHERE username = 'admin';" >/dev/null 2>&1
            echo "✅ Admin password updated to 'admin123'"
        fi
    else
        echo "❌ Default admin user does not exist"
        echo ""
        echo "🔧 Creating admin user..."
        docker-compose exec -T postgres psql -U blabbme_user -d blabbme_db -c "INSERT INTO admins (username, password) VALUES ('admin', 'admin123') ON CONFLICT (username) DO UPDATE SET password = 'admin123';" >/dev/null 2>&1
        echo "✅ Admin user created with username 'admin' and password 'admin123'"
    fi
else
    echo "❌ Admins table does not exist"
    echo "This suggests the database initialization didn't run properly."
    echo ""
    echo "🔧 Rebuilding containers with fresh database..."
    docker-compose down -v
    docker-compose up -d --build
    echo "Please wait for containers to start and run this script again."
    exit 1
fi

echo ""
echo "🧪 Testing admin login via API..."

# Wait a moment for the app to be ready
sleep 2

# Test the login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "failed")

if [[ $LOGIN_RESPONSE == *"Login successful"* ]] || [[ $LOGIN_RESPONSE == *"admin"* ]]; then
    echo "✅ Admin login test PASSED"
    echo "🎉 Admin account is working correctly!"
else
    echo "❌ Admin login test FAILED"
    echo "Response: $LOGIN_RESPONSE"
    echo ""
    echo "💡 This could mean:"
    echo "   - The app container is not running"
    echo "   - The app is not ready yet (try waiting and running again)"
    echo "   - There's a configuration issue"
fi

echo ""
echo "=== Summary ==="
echo "Admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Admin login URL: http://localhost:3000/admin/login"
echo "API endpoint: http://localhost:3000/api/auth/login"