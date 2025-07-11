#!/bin/bash

# Test script to verify Docker build properly uses environment variables
# Usage: ./test-docker-env.sh

echo "=== Testing Docker Environment Variable Integration ==="
echo

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✓ .env file found"
    echo "Current VITE_* variables in .env:"
    grep "^VITE_" .env || echo "  No VITE_* variables found in .env"
else
    echo "⚠ No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file from .env.example"
fi

echo
echo "=== Testing with features disabled ==="

# Create a test .env with features disabled
echo "Creating test configuration with all features disabled..."
cat > .env.test << EOF
# Test configuration - all features disabled
POSTGRES_PASSWORD=test_password_123
SESSION_SECRET=test_session_secret_very_long_random_string_here
VITE_SHOW_HERO_DESCRIPTION=false
VITE_SHOW_FEATURES_SECTION=false
VITE_SHOW_START_BUTTON=false
EOF

echo "✓ Created .env.test with all features disabled"
echo
echo "To test Docker build with disabled features:"
echo "1. Copy .env.test to .env: cp .env.test .env"
echo "2. Rebuild containers: docker-compose down && docker-compose build --no-cache"
echo "3. Start containers: docker-compose up"
echo "4. Visit the site - you should see a minimal landing page with no buttons or features"
echo
echo "To restore normal functionality:"
echo "1. Copy .env.example to .env: cp .env.example .env"
echo "2. Rebuild and restart as above"
echo
echo "=== Current Docker build configuration ==="
echo "Build args will be passed from your .env file:"
echo "- VITE_SHOW_HERO_DESCRIPTION: ${VITE_SHOW_HERO_DESCRIPTION:-true}"
echo "- VITE_SHOW_FEATURES_SECTION: ${VITE_SHOW_FEATURES_SECTION:-true}"  
echo "- VITE_SHOW_START_BUTTON: ${VITE_SHOW_START_BUTTON:-true}"
echo
echo "=== Important Notes ==="
echo "• Environment variables are embedded during Docker BUILD time, not runtime"
echo "• Changes to .env require: docker-compose build --no-cache"
echo "• The variables control frontend React component visibility"
echo "• Setting any variable to 'false' will hide that section"