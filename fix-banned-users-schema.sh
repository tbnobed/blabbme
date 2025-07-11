#!/bin/bash

# Script to fix the banned_users table schema in running Docker deployment
# This adds the missing banned_at column to existing deployments

echo "=== Fixing banned_users table schema ==="

# Check if docker-compose is running
if ! docker-compose ps | grep -q "app.*Up"; then
    echo "Error: Docker containers are not running. Please start with 'docker-compose up -d'"
    exit 1
fi

echo "Running schema fix migration..."

# Execute the schema fix SQL directly in the database
docker-compose exec postgres psql -U blabbme_user -d blabbme_db << 'EOF'
-- Check current schema
\echo 'Current banned_users table structure:'
\d banned_users;

-- Add missing banned_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'banned_users' AND column_name = 'banned_at'
    ) THEN
        ALTER TABLE banned_users ADD COLUMN banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added banned_at column';
        
        -- Update existing records if they have created_at
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'banned_users' AND column_name = 'created_at'
        ) THEN
            UPDATE banned_users SET banned_at = created_at WHERE banned_at IS NULL;
            ALTER TABLE banned_users DROP COLUMN created_at;
            RAISE NOTICE 'Migrated data from created_at to banned_at';
        END IF;
    ELSE
        RAISE NOTICE 'banned_at column already exists';
    END IF;
    
    -- Fix reason column default
    ALTER TABLE banned_users ALTER COLUMN reason SET DEFAULT 'kicked_by_admin';
END $$;

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);

-- Show updated structure
\echo 'Updated banned_users table structure:'
\d banned_users;

\echo 'Schema fix completed successfully!';
EOF

echo "=== Schema fix completed ==="
echo "Restarting application containers..."

# Restart app container to clear any cached issues
docker-compose restart app

echo "=== Application restarted ==="
echo "Check logs with: docker-compose logs -f app"