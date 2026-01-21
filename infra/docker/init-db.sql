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

-- Subscription payments table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    smart_account_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    interval_seconds INTEGER NOT NULL,
    next_execution_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_execution ON subscriptions(next_execution_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_smart_account ON subscriptions(smart_account_address);

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
