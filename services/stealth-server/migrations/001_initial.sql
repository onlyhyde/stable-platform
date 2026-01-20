-- Stealth Server Database Schema
-- EIP-5564 Announcements and Registration Storage

-- Announcements table
-- Stores Announcement events from ERC5564Announcer contract
CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,

    -- Announcement data (from event)
    scheme_id BIGINT NOT NULL,
    stealth_address VARCHAR(42) NOT NULL,
    caller VARCHAR(42) NOT NULL,
    ephemeral_pub_key TEXT NOT NULL,
    metadata TEXT NOT NULL,

    -- Extracted view tag (first byte of metadata if present)
    view_tag SMALLINT,

    -- Block info
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(transaction_hash, log_index)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_announcements_block_number ON announcements(block_number DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_stealth_address ON announcements(stealth_address);
CREATE INDEX IF NOT EXISTS idx_announcements_view_tag ON announcements(view_tag) WHERE view_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_scheme_id ON announcements(scheme_id);
CREATE INDEX IF NOT EXISTS idx_announcements_caller ON announcements(caller);

-- Registrations table
-- Stores stealth meta-address registrations (EIP-6538)
CREATE TABLE IF NOT EXISTS registrations (
    id BIGSERIAL PRIMARY KEY,

    -- Registrant address
    address VARCHAR(42) NOT NULL,

    -- Scheme (1 = secp256k1, 2 = ed25519, etc.)
    scheme_id BIGINT NOT NULL DEFAULT 1,

    -- Stealth meta-address components
    chain VARCHAR(10) NOT NULL DEFAULT 'eth',
    spending_pub_key VARCHAR(68) NOT NULL,  -- Compressed public key (33 bytes = 66 hex + 0x)
    viewing_pub_key VARCHAR(68) NOT NULL,   -- Compressed public key (33 bytes = 66 hex + 0x)

    -- Signature proving ownership
    signature TEXT NOT NULL,

    -- Metadata
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(address, scheme_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_registrations_address ON registrations(address);
CREATE INDEX IF NOT EXISTS idx_registrations_chain ON registrations(chain);

-- Sync state table
-- Tracks the last processed block for resuming indexing
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_block_number BIGINT NOT NULL DEFAULT 0,
    last_block_hash VARCHAR(66),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one row
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial sync state
INSERT INTO sync_state (id, last_block_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
