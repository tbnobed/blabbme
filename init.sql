-- Initialize the blabb.me database with required tables
-- This file will be executed when the PostgreSQL container starts for the first time
-- Complete schema with auto-ban system and warnings tracking
\echo 'Starting database initialization for blabb.me...'

-- Set timezone
SET timezone = 'UTC';

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create the sessions table for express-session storage
\echo 'Creating sessions table...'
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Create the admins table
\echo 'Creating admins table...'
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the rooms table
\echo 'Creating rooms table...'
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL DEFAULT 'anonymous',
    max_participants INTEGER DEFAULT 10,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create the participants table
\echo 'Creating participants table...'
CREATE TABLE IF NOT EXISTS participants (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    socket_id VARCHAR(255) UNIQUE NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_participants_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Create the messages table
\echo 'Creating messages table...'
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_filtered BOOLEAN DEFAULT false,
    CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Create the banned_users table for user ban management
\echo 'Creating banned_users table...'
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
\echo 'Creating warnings table...'
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

-- Create indexes for better performance
\echo 'Creating database indexes...'
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions (expire);
CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_socket_id ON participants(socket_id);
CREATE INDEX IF NOT EXISTS idx_participants_room_nickname ON participants(room_id, nickname);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_room_timestamp ON messages(room_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_banned_users_room_id ON banned_users(room_id);
CREATE INDEX IF NOT EXISTS idx_banned_users_expires_at ON banned_users(expires_at);
CREATE INDEX IF NOT EXISTS idx_banned_users_banned_at ON banned_users(banned_at);
CREATE INDEX IF NOT EXISTS idx_banned_users_session_nickname ON banned_users(room_id, session_id, nickname);
CREATE INDEX IF NOT EXISTS idx_warnings_room_id ON warnings(room_id);
CREATE INDEX IF NOT EXISTS idx_warnings_created_at ON warnings(created_at);
CREATE INDEX IF NOT EXISTS idx_warnings_room_session_nickname ON warnings(room_id, session_id, nickname);
CREATE INDEX IF NOT EXISTS idx_warnings_room_created_at ON warnings(room_id, created_at);

-- Insert default admin user (username: admin, password: admin123)
-- Using plain text password for simplicity
\echo 'Creating default admin user...'
INSERT INTO admins (username, password) 
VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- Create cleanup functions for expired content
\echo 'Creating cleanup functions...'
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rooms 
    WHERE expires_at < NOW() AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup expired bans
CREATE OR REPLACE FUNCTION cleanup_expired_bans()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM banned_users 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old warnings (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_warnings()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM warnings 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
\echo 'Setting up permissions...'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO blabbme_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO blabbme_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_rooms() TO blabbme_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_bans() TO blabbme_user;
GRANT EXECUTE ON FUNCTION cleanup_old_warnings() TO blabbme_user;

-- Set up automatic cleanup (this will be handled by the application)
-- But we create the function here for manual cleanup if needed

\echo 'Database initialization completed successfully!'

-- Display some useful information
\echo 'Database statistics:'
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY tablename, attname;