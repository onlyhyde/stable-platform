-- StableNet Database Initialization Script
-- Creates necessary tables for all services

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Subscription Executor Tables
-- =============================================================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id VARCHAR(66) NOT NULL UNIQUE,  -- bytes32 from contract
    subscriber_address VARCHAR(42) NOT NULL,
    service_provider VARCHAR(42) NOT NULL,
    payment_token VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,  -- uint256
    interval_seconds INTEGER NOT NULL,
    next_execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying of due subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_execution
    ON subscriptions(next_execution_time)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber
    ON subscriptions(subscriber_address);

-- Execution history table
CREATE TABLE IF NOT EXISTS execution_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL,  -- 'pending', 'success', 'failed'
    gas_used NUMERIC(78, 0),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_history_subscription
    ON execution_history(subscription_id);

CREATE INDEX IF NOT EXISTS idx_execution_history_status
    ON execution_history(status);

-- =============================================================================
-- Bridge Relayer Tables
-- =============================================================================

-- Bridge transfers table
CREATE TABLE IF NOT EXISTS bridge_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id VARCHAR(66) NOT NULL UNIQUE,  -- bytes32 from contract
    source_chain_id INTEGER NOT NULL,
    target_chain_id INTEGER NOT NULL,
    sender_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    status VARCHAR(20) NOT NULL,  -- 'pending', 'confirmed', 'relayed', 'completed', 'failed'
    source_tx_hash VARCHAR(66),
    target_tx_hash VARCHAR(66),
    block_number BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_transfers_status
    ON bridge_transfers(status);

CREATE INDEX IF NOT EXISTS idx_bridge_transfers_sender
    ON bridge_transfers(sender_address);

-- MPC signatures table
CREATE TABLE IF NOT EXISTS mpc_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES bridge_transfers(id),
    signer_index INTEGER NOT NULL,
    signature BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(transfer_id, signer_index)
);

-- =============================================================================
-- Order Router Tables
-- =============================================================================

-- Swap quotes cache
CREATE TABLE IF NOT EXISTS swap_quotes_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_in VARCHAR(42) NOT NULL,
    token_out VARCHAR(42) NOT NULL,
    amount_in NUMERIC(78, 0) NOT NULL,
    amount_out NUMERIC(78, 0) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    route_data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swap_quotes_tokens
    ON swap_quotes_cache(token_in, token_out);

CREATE INDEX IF NOT EXISTS idx_swap_quotes_expires
    ON swap_quotes_cache(expires_at);

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to bridge_transfers
DROP TRIGGER IF EXISTS update_bridge_transfers_updated_at ON bridge_transfers;
CREATE TRIGGER update_bridge_transfers_updated_at
    BEFORE UPDATE ON bridge_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Cleanup job for expired cache entries
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM swap_quotes_cache WHERE expires_at < NOW();
END;
$$ language 'plpgsql';
