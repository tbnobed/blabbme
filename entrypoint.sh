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
      console.log('Database initialization completed!');
    } else {
      console.log('Database already initialized');
      
      // Check if warnings table exists (migration check)
      const warningsResult = await pool.query(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'warnings'\");
      
      if (warningsResult.rows.length === 0) {
        console.log('Running migration: Adding warnings and banned_users tables...');
        const migrationSql = \`
          -- Create the banned_users table for user ban management
          CREATE TABLE IF NOT EXISTS banned_users (
              id SERIAL PRIMARY KEY,
              room_id VARCHAR(255) NOT NULL,
              session_id VARCHAR(255),
              nickname VARCHAR(255) NOT NULL,
              banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              expires_at TIMESTAMP NOT NULL,
              reason VARCHAR(255) DEFAULT 'kicked_by_admin',
              CONSTRAINT fk_banned_users_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
          );

          -- Create the warnings table for content moderation tracking
          CREATE TABLE IF NOT EXISTS warnings (
              id SERIAL PRIMARY KEY,
              room_id VARCHAR(255) NOT NULL,
              session_id VARCHAR(255),
              nickname VARCHAR(255) NOT NULL,
              original_message TEXT NOT NULL,
              filtered_message TEXT NOT NULL,
              warning_type VARCHAR(50) DEFAULT 'profanity',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT fk_warnings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
          );

          -- Create indexes for the new tables
          CREATE INDEX IF NOT EXISTS idx_banned_users_room_id ON banned_users(room_id);
          CREATE INDEX IF NOT EXISTS idx_banned_users_expires_at ON banned_users(expires_at);
          CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);
          CREATE INDEX IF NOT EXISTS idx_banned_users_session_nickname ON banned_users(room_id, session_id, nickname);
          CREATE INDEX IF NOT EXISTS idx_warnings_room_id ON warnings(room_id);
          CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at);
          CREATE INDEX IF NOT EXISTS idx_warnings_room_session_nickname ON warnings(room_id, session_id, nickname);
          CREATE INDEX IF NOT EXISTS idx_warnings_room_created_at ON warnings(room_id, created_at);

          -- Create cleanup functions
          CREATE OR REPLACE FUNCTION cleanup_expired_bans()
          RETURNS INTEGER AS \$\$
          DECLARE
              deleted_count INTEGER;
          BEGIN
              DELETE FROM banned_users WHERE expires_at < NOW();
              GET DIAGNOSTICS deleted_count = ROW_COUNT;
              RETURN deleted_count;
          END;
          \$\$ LANGUAGE plpgsql;

          CREATE OR REPLACE FUNCTION cleanup_old_warnings()
          RETURNS INTEGER AS \$\$
          DECLARE
              deleted_count INTEGER;
          BEGIN
              DELETE FROM warnings WHERE created_at < NOW() - INTERVAL '30 days';
              GET DIAGNOSTICS deleted_count = ROW_COUNT;
              RETURN deleted_count;
          END;
          \$\$ LANGUAGE plpgsql;
        \`;
        
        await pool.query(migrationSql);
        console.log('Migration completed successfully!');
      } else {
        console.log('Warnings table exists, no migration needed');
      }
      
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