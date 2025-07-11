-- Verification script to check table schemas match expectations
-- Run this to verify all tables have the correct column names

-- Check banned_users table structure
\echo 'Checking banned_users table structure:'
\d+ banned_users;

-- Check warnings table structure
\echo 'Checking warnings table structure:'
\d+ warnings;

-- Verify column names exist
\echo 'Testing banned_users columns:'
SELECT id, room_id, session_id, nickname, banned_at, expires_at, reason FROM banned_users LIMIT 0;

\echo 'Testing warnings columns:'
SELECT id, room_id, session_id, nickname, original_message, filtered_message, warning_type, created_at FROM warnings LIMIT 0;

\echo 'Schema verification complete!'