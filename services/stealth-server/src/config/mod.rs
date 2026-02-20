use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub indexer: IndexerConfig,
    pub stealth: StealthConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    /// Connection acquire timeout in seconds (default: 30)
    pub acquire_timeout_secs: u64,
    /// Idle connection timeout in seconds (default: 600 = 10 minutes)
    pub idle_timeout_secs: u64,
    /// Maximum connection lifetime in seconds (default: 1800 = 30 minutes)
    pub max_lifetime_secs: u64,
    /// Statement timeout in seconds (default: 30)
    pub statement_timeout_secs: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct IndexerConfig {
    pub websocket_url: String,
    pub reconnect_interval_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StealthConfig {
    pub announcer_address: String,
    pub chain_id: u64,
    pub start_block: u64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Config {
            server: ServerConfig {
                host: env::var("HOST")
                    .or_else(|_| env::var("SERVER_HOST"))
                    .unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: env::var("PORT")
                    .or_else(|_| env::var("SERVER_PORT"))
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()?,
            },
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgres://localhost/stealth".to_string()),
                max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()?,
                acquire_timeout_secs: env::var("DATABASE_ACQUIRE_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()?,
                idle_timeout_secs: env::var("DATABASE_IDLE_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "600".to_string())
                    .parse()?,
                max_lifetime_secs: env::var("DATABASE_MAX_LIFETIME_SECS")
                    .unwrap_or_else(|_| "1800".to_string())
                    .parse()?,
                statement_timeout_secs: env::var("DATABASE_STATEMENT_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()?,
            },
            indexer: IndexerConfig {
                websocket_url: env::var("INDEXER_WS_URL")
                    .unwrap_or_else(|_| "ws://localhost:8080/ws".to_string()),
                reconnect_interval_ms: env::var("INDEXER_RECONNECT_INTERVAL_MS")
                    .unwrap_or_else(|_| "5000".to_string())
                    .parse()?,
            },
            stealth: StealthConfig {
                announcer_address: env::var("STEALTH_ANNOUNCER_ADDRESS")
                    .unwrap_or_else(|_| "0x55649E01B5Df198D18D95b5cc5051630cfD45564".to_string()),
                chain_id: env::var("CHAIN_ID")
                    .unwrap_or_else(|_| "31337".to_string())
                    .parse()?,
                start_block: env::var("STEALTH_START_BLOCK")
                    .unwrap_or_else(|_| "0".to_string())
                    .parse()?,
            },
        })
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8080,
            },
            database: DatabaseConfig {
                url: "postgres://localhost/stealth".to_string(),
                max_connections: 10,
                acquire_timeout_secs: 30,
                idle_timeout_secs: 600,
                max_lifetime_secs: 1800,
                statement_timeout_secs: 30,
            },
            indexer: IndexerConfig {
                websocket_url: "ws://localhost:8080/ws".to_string(),
                reconnect_interval_ms: 5000,
            },
            stealth: StealthConfig {
                announcer_address: "0x55649E01B5Df198D18D95b5cc5051630cfD45564".to_string(),
                chain_id: 31337,
                start_block: 0,
            },
        }
    }
}
