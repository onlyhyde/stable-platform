-- Subscription Executor Database Schema
-- Following Supabase/Postgres Best Practices

-- =============================================================================
-- Subscriptions Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    -- Primary key: Use text ID for compatibility with existing API
    id TEXT PRIMARY KEY,

    -- Core subscription data
    smart_account VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    token VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,  -- uint256 max = 78 digits
    interval_seconds BIGINT NOT NULL,

    -- Execution tracking
    next_execution TIMESTAMPTZ NOT NULL,
    last_execution TIMESTAMPTZ,
    execution_count BIGINT NOT NULL DEFAULT 0,
    max_executions BIGINT NOT NULL DEFAULT 0,  -- 0 = unlimited

    -- Status with CHECK constraint (better than enum for migrations)
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Subscriptions
-- =============================================================================

-- Index for finding subscriptions by account (common query)
CREATE INDEX IF NOT EXISTS idx_subscriptions_smart_account
ON subscriptions (smart_account);

-- Composite index for polling due subscriptions
-- Optimizes: WHERE status = 'active' AND next_execution <= NOW()
-- Column order: equality (status) before range (next_execution)
CREATE INDEX IF NOT EXISTS idx_subscriptions_due
ON subscriptions (status, next_execution)
WHERE status = 'active';

-- Partial index for active subscriptions only
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_account
ON subscriptions (smart_account)
WHERE status = 'active';

-- Index for cursor-based pagination
CREATE INDEX IF NOT EXISTS idx_subscriptions_cursor
ON subscriptions (created_at DESC, id);

-- =============================================================================
-- Execution Records Table (Audit Log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS execution_records (
    -- Primary key: BIGSERIAL for high-volume inserts
    id BIGSERIAL PRIMARY KEY,

    -- Foreign key to subscription
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

    -- Transaction tracking
    user_op_hash VARCHAR(66),
    tx_hash VARCHAR(66),

    -- Execution status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed')),
    error TEXT,
    gas_used NUMERIC(78, 0),

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Execution Records
-- =============================================================================

-- Index for finding records by subscription
CREATE INDEX IF NOT EXISTS idx_execution_records_subscription
ON execution_records (subscription_id, created_at DESC);

-- Index for finding by transaction hash
CREATE INDEX IF NOT EXISTS idx_execution_records_tx_hash
ON execution_records (tx_hash)
WHERE tx_hash IS NOT NULL;

-- Partial index for pending executions (for retry logic)
CREATE INDEX IF NOT EXISTS idx_execution_records_pending
ON execution_records (subscription_id, created_at)
WHERE status = 'pending';

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subscriptions
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Initial Statistics
-- =============================================================================
ANALYZE subscriptions;
ANALYZE execution_records;
