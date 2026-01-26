-- StableNet PostgreSQL Initialization Script
-- Creates necessary databases and extensions

-- Create stealth database
CREATE DATABASE stablenet_stealth;

-- Connect to stablenet_stealth and add extensions
\c stablenet_stealth;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create stealth schema tables
CREATE TABLE IF NOT EXISTS stealth_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spending_public_key BYTEA NOT NULL,
    viewing_public_key BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stealth_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stealth_address VARCHAR(42) NOT NULL,
    ephemeral_public_key BYTEA NOT NULL,
    metadata BYTEA,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_announcement UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_announcements_stealth_address ON stealth_announcements(stealth_address);
CREATE INDEX IF NOT EXISTS idx_announcements_block_number ON stealth_announcements(block_number);

-- Switch back to main database
\c stablenet;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- Subscription Executor Tables
-- =============================================================================

-- Subscription payments table (matches subscription-executor service schema)
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    smart_account VARCHAR(42) NOT NULL,
    recipient VARCHAR(42) NOT NULL,
    token VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    interval_seconds BIGINT NOT NULL,
    next_execution TIMESTAMPTZ NOT NULL,
    last_execution TIMESTAMPTZ,
    execution_count BIGINT NOT NULL DEFAULT 0,
    max_executions BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for subscriptions (following Postgres best practices)
CREATE INDEX IF NOT EXISTS idx_subscriptions_smart_account ON subscriptions(smart_account);
CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON subscriptions(status, next_execution) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_account ON subscriptions(smart_account) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_cursor ON subscriptions(created_at DESC, id);

-- Execution records for audit trail
CREATE TABLE IF NOT EXISTS execution_records (
    id BIGSERIAL PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_op_hash VARCHAR(66),
    tx_hash VARCHAR(66),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed')),
    error TEXT,
    gas_used NUMERIC(78, 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_records_subscription ON execution_records(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_records_tx_hash ON execution_records(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_records_pending ON execution_records(subscription_id, created_at) WHERE status = 'pending';

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User operations history
CREATE TABLE IF NOT EXISTS user_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_op_hash VARCHAR(66) NOT NULL UNIQUE,
    sender VARCHAR(42) NOT NULL,
    nonce NUMERIC(78, 0) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    tx_hash VARCHAR(66),
    block_number BIGINT,
    gas_used NUMERIC(78, 0),
    actual_gas_cost NUMERIC(78, 0),
    success BOOLEAN,
    revert_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ops_sender ON user_operations(sender);
CREATE INDEX IF NOT EXISTS idx_user_ops_status ON user_operations(status);
CREATE INDEX IF NOT EXISTS idx_user_ops_created ON user_operations(created_at DESC);

-- Paymaster deposits
CREATE TABLE IF NOT EXISTS paymaster_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_address VARCHAR(42) NOT NULL,
    paymaster_address VARCHAR(42) NOT NULL,
    deposit_amount NUMERIC(78, 0) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_account ON paymaster_deposits(account_address);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stablenet;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stablenet;
