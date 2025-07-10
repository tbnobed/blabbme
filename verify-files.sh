#!/bin/bash

echo "=== Verifying deployment files ==="
echo ""

echo "1. Checking Dockerfile build command:"
grep -n "RUN.*build" Dockerfile

echo ""
echo "2. Checking if build-server.js exists:"
if [ -f "build-server.js" ]; then
    echo "✓ build-server.js found"
    head -5 build-server.js
else
    echo "✗ build-server.js missing"
fi

echo ""
echo "3. Checking docker-compose.yml networks:"
grep -A 3 "networks:" docker-compose.yml

echo ""
echo "4. Checking init.sql exists:"
if [ -f "init.sql" ]; then
    echo "✓ init.sql found ($(wc -l < init.sql) lines)"
else
    echo "✗ init.sql missing"
fi

echo ""
echo "5. Checking .env file:"
if [ -f ".env" ]; then
    echo "✓ .env found"
    echo "Environment variables set:"
    grep -E "^[A-Z]" .env | cut -d= -f1
else
    echo "✗ .env missing - you need to create this"
    echo "Copy .env.example to .env and set your passwords"
fi

echo ""
echo "=== Verification complete ==="