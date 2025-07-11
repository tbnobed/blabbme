-- Migration 002: Fix banned_users table schema
-- This migration adds the missing banned_at column to existing banned_users table

\echo 'Running migration 002: Fixing banned_users table schema...'

-- Check if banned_at column exists, if not add it
DO $$
BEGIN
    -- Check if banned_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'banned_users' 
        AND column_name = 'banned_at'
    ) THEN
        -- Add the missing banned_at column
        ALTER TABLE banned_users ADD COLUMN banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        -- Update existing rows to have banned_at = created_at if created_at exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'banned_users' 
            AND column_name = 'created_at'
        ) THEN
            UPDATE banned_users SET banned_at = created_at WHERE banned_at IS NULL;
            -- Drop the old created_at column if it exists
            ALTER TABLE banned_users DROP COLUMN IF EXISTS created_at;
        END IF;
        
        RAISE NOTICE 'Added banned_at column to banned_users table';
    ELSE
        RAISE NOTICE 'banned_at column already exists in banned_users table';
    END IF;
    
    -- Ensure reason column has correct default
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'banned_users' 
        AND column_name = 'reason'
    ) THEN
        ALTER TABLE banned_users ALTER COLUMN reason SET DEFAULT 'kicked_by_admin';
        RAISE NOTICE 'Updated reason column default value';
    END IF;
END $$;

-- Create missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);

\echo 'Migration 002 completed successfully!'