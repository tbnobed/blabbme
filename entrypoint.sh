#!/bin/sh

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
      console.log('✓ Database initialization completed with full schema!');
      console.log('✓ All tables created: admins, rooms, participants, messages, banned_users, warnings');
      console.log('✓ All indexes and functions created');
      console.log('✓ Default admin user created: admin/admin123');
    } else {
      console.log('Database already initialized');
      
      // Check and fix schema issues for existing deployments
      console.log('Checking schema compatibility...');
      
      // Check if banned_at column exists
      const bannedAtCheck = await pool.query(\`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'banned_users' AND column_name = 'banned_at'
      \`);
      
      if (bannedAtCheck.rows.length === 0) {
        console.log('Fixing banned_users table schema...');
        await pool.query(\`
          ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          UPDATE banned_users SET banned_at = CURRENT_TIMESTAMP WHERE banned_at IS NULL;
        \`);
        console.log('✓ banned_users table schema fixed');
      }
      
      // Check if created_at column exists in warnings table
      const warningCreatedCheck = await pool.query(\`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'warnings' AND column_name = 'created_at'
      \`);
      
      if (warningCreatedCheck.rows.length === 0) {
        console.log('Fixing warnings table schema...');
        await pool.query(\`
          ALTER TABLE warnings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          UPDATE warnings SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
        \`);
        console.log('✓ warnings table schema fixed');
      }
      
      // Ensure admin user exists with correct password
      await pool.query(\`
        INSERT INTO admins (username, password) 
        VALUES ('admin', 'admin123') 
        ON CONFLICT (username) 
        DO UPDATE SET password = 'admin123'
      \`);
      console.log('Admin user verified/updated');
      console.log('Schema compatibility check completed');
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