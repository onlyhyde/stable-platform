-- Idempotency Support Migration
-- Layer A: API request idempotency via Idempotency-Key header
-- Layer B: Execution dedup via unique partial index on pending records

-- =============================================================================
-- Idempotency Keys Table (API Layer)
-- =============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    response_headers JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (key, method, path)
);

-- Index for TTL cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
ON idempotency_keys (expires_at);

-- =============================================================================
-- Execution Records: Prevent duplicate pending executions per subscription
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_records_pending_unique
ON execution_records (subscription_id)
WHERE status = 'pending';

ANALYZE idempotency_keys;
