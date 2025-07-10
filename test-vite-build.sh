#!/bin/bash

echo "=== Testing Vite Build Locally ==="

# Test the vite build locally to see what's happening
echo "Running vite build..."
npx vite build --outDir dist/public

echo ""
echo "Build completed. Checking output..."
ls -la dist/ 2>/dev/null || echo "No dist directory"

echo ""
echo "Looking for built files..."
find . -name "*.html" -o -name "*.js" -o -name "*.css" | grep -v node_modules | head -10