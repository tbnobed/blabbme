#!/bin/bash

echo "=== Blabb.me Application Startup ==="

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

# Run database migrations/setup
echo "Setting up database schema..."
node -e "
const { Pool } = require('pg');
const fs = require('fs');

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check if tables exist
    const result = await pool.query(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admins'\");
    
    if (result.rows.length === 0) {
      console.log('Running database initialization...');
      const initSql = fs.readFileSync('./init.sql', 'utf8');
      await pool.query(initSql);
      console.log('Database initialization completed!');
    } else {
      console.log('Database already initialized');
      
      // Ensure admin user exists with correct password
      await pool.query(\`
        INSERT INTO admins (username, password) 
        VALUES ('admin', 'admin123') 
        ON CONFLICT (username) 
        DO UPDATE SET password = 'admin123'
      \`);
      console.log('Admin user verified/updated');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Database setup error:', error);
    process.exit(1);
  }
}

setupDatabase();
"

echo "Starting application..."
exec node dist/index.js