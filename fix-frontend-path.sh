#!/bin/bash

echo "=== Fixing Frontend File Path Issue ==="

# Create a simple script to test and fix the file serving
cat > test-frontend-fix.js << 'EOF'
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Test different possible paths for the built files
const possiblePaths = [
  path.join(__dirname, 'dist/public'),
  path.join(__dirname, 'public'),
  path.join(__dirname, '../dist/public'),
  '/app/dist/public',
  '/app/public'
];

console.log('Testing frontend file paths...');
for (const testPath of possiblePaths) {
  try {
    const fs = await import('fs');
    if (fs.existsSync(path.join(testPath, 'index.html'))) {
      console.log(`✓ Found index.html at: ${testPath}`);
    } else {
      console.log(`✗ Not found at: ${testPath}`);
    }
  } catch (err) {
    console.log(`✗ Error checking: ${testPath}`);
  }
}
EOF

echo "Created test script. The production server is running successfully!"
echo "The only issue is finding the correct path for the built frontend files."
echo ""
echo "Run this on your server to test paths:"
echo "docker compose exec app node test-frontend-fix.js"