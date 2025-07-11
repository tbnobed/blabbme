-- Migration 001: Add warnings and banned_users tables
-- Run this migration on existing databases to add the new moderation features

\echo 'Running migration 001: Adding warnings and banned_users tables...'

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

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON TABLE banned_users TO blabbme_user;
GRANT ALL PRIVILEGES ON TABLE warnings TO blabbme_user;
GRANT USAGE, SELECT ON SEQUENCE banned_users_id_seq TO blabbme_user;
GRANT USAGE, SELECT ON SEQUENCE warnings_id_seq TO blabbme_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_bans() TO blabbme_user;
GRANT EXECUTE ON FUNCTION cleanup_old_warnings() TO blabbme_user;

\echo 'Migration 001 completed successfully!'