-- Performance Optimization Migration
-- Based on Supabase/Postgres Best Practices

-- =============================================================================
-- 1. Composite Indexes for Multi-Column Queries
-- =============================================================================

-- Composite index for get_announcements() query filtering
-- Supports: WHERE block_number >= $1 AND block_number <= $2 AND view_tag = $3
-- Column order: equality columns first (view_tag), then range columns (block_number)
CREATE INDEX IF NOT EXISTS idx_announcements_view_tag_block
ON announcements (view_tag, block_number DESC)
WHERE view_tag IS NOT NULL;

-- Composite index for queries filtering by scheme_id and block range
CREATE INDEX IF NOT EXISTS idx_announcements_scheme_block
ON announcements (scheme_id, block_number DESC);

-- =============================================================================
-- 2. Covering Indexes to Avoid Table Lookups (Index-Only Scans)
-- =============================================================================

-- Covering index for get_announcement_by_stealth_address()
-- Includes all SELECT columns to enable index-only scan
CREATE INDEX IF NOT EXISTS idx_announcements_stealth_covering
ON announcements (stealth_address)
INCLUDE (scheme_id, caller, ephemeral_pub_key, metadata, view_tag, block_number, transaction_hash, log_index, created_at);

-- Covering index for registrations lookup
CREATE INDEX IF NOT EXISTS idx_registrations_address_covering
ON registrations (address, scheme_id)
INCLUDE (chain, spending_pub_key, viewing_pub_key, signature, registered_at);

-- =============================================================================
-- 3. Index for Cursor-Based Pagination
-- =============================================================================

-- Composite index for cursor pagination on announcements
-- Supports: WHERE (block_number, log_index) < ($cursor_block, $cursor_log_index)
CREATE INDEX IF NOT EXISTS idx_announcements_cursor
ON announcements (block_number DESC, log_index DESC);

-- =============================================================================
-- 4. Analyze Tables for Optimal Query Plans
-- =============================================================================

ANALYZE announcements;
ANALYZE registrations;
ANALYZE sync_state;
