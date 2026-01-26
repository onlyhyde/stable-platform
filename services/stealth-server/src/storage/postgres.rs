use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::FromRow;
use std::time::Duration;
use thiserror::Error;
use tracing::info;

use crate::config::DatabaseConfig;
use crate::parser::Announcement;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
    #[error("Not found: {0}")]
    NotFound(String),
}

/// Announcement row from database
#[derive(Debug, FromRow)]
pub struct AnnouncementRow {
    pub id: i64,
    pub scheme_id: i64,
    pub stealth_address: String,
    pub caller: String,
    pub ephemeral_pub_key: String,
    pub metadata: String,
    pub view_tag: Option<i16>,
    pub block_number: i64,
    pub transaction_hash: String,
    pub log_index: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<AnnouncementRow> for Announcement {
    fn from(row: AnnouncementRow) -> Self {
        Announcement {
            scheme_id: row.scheme_id as u64,
            stealth_address: row.stealth_address,
            caller: row.caller,
            ephemeral_pub_key: row.ephemeral_pub_key,
            metadata: row.metadata,
            view_tag: row.view_tag.map(|v| v as u8),
            block_number: row.block_number as u64,
            transaction_hash: row.transaction_hash,
            log_index: row.log_index as u32,
        }
    }
}

/// Registration row from database
#[derive(Debug, FromRow)]
pub struct RegistrationRow {
    pub id: i64,
    pub address: String,
    pub scheme_id: i64,
    pub chain: String,
    pub spending_pub_key: String,
    pub viewing_pub_key: String,
    pub signature: String,
    pub registered_at: chrono::DateTime<chrono::Utc>,
}

/// PostgreSQL storage for stealth server
#[derive(Clone)]
pub struct Storage {
    pool: PgPool,
}

impl Storage {
    /// Create a new storage instance with connection pool optimizations
    /// - Configurable timeouts prevent connection leaks
    /// - Statement timeout prevents runaway queries
    pub async fn new(config: &DatabaseConfig) -> Result<Self, StorageError> {
        // Copy timeout value to avoid lifetime issues with closure
        let statement_timeout_secs = config.statement_timeout_secs;

        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            // Connection acquire timeout - fail fast if pool exhausted
            .acquire_timeout(Duration::from_secs(config.acquire_timeout_secs))
            // Idle connection timeout - reclaim unused connections
            .idle_timeout(Duration::from_secs(config.idle_timeout_secs))
            // Max connection lifetime - prevent stale connections
            .max_lifetime(Duration::from_secs(config.max_lifetime_secs))
            // Set statement timeout on each connection to prevent runaway queries
            .after_connect(move |conn, _meta| {
                Box::pin(async move {
                    sqlx::query(&format!("SET statement_timeout = '{}s'", statement_timeout_secs))
                        .execute(conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(&config.url)
            .await?;

        info!("Connected to database with pool optimizations");
        Ok(Storage { pool })
    }

    /// Run database migrations
    pub async fn migrate(&self) -> Result<(), StorageError> {
        sqlx::migrate::Migrator::new(std::path::Path::new("./migrations"))
            .await?
            .run(&self.pool)
            .await?;
        info!("Database migrations completed");
        Ok(())
    }

    /// Save an announcement
    pub async fn save_announcement(&self, announcement: &Announcement) -> Result<i64, StorageError> {
        let row: Option<(i64,)> = sqlx::query_as(
            r#"
            INSERT INTO announcements (
                scheme_id, stealth_address, caller, ephemeral_pub_key,
                metadata, view_tag, block_number, transaction_hash, log_index
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (transaction_hash, log_index) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(announcement.scheme_id as i64)
        .bind(&announcement.stealth_address)
        .bind(&announcement.caller)
        .bind(&announcement.ephemeral_pub_key)
        .bind(&announcement.metadata)
        .bind(announcement.view_tag.map(|v| v as i16))
        .bind(announcement.block_number as i64)
        .bind(&announcement.transaction_hash)
        .bind(announcement.log_index as i32)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.0).unwrap_or(0))
    }

    /// Get announcements with optional filters using cursor-based pagination
    ///
    /// # Cursor-Based Pagination (Best Practice)
    /// Instead of OFFSET which scans all skipped rows (O(n)), this uses
    /// keyset/cursor pagination which is O(1) regardless of page depth.
    ///
    /// # Arguments
    /// * `from_block` - Filter: block_number >= from_block
    /// * `to_block` - Filter: block_number <= to_block
    /// * `view_tag` - Filter: view_tag = view_tag
    /// * `limit` - Maximum number of results (default: 100)
    /// * `cursor` - Cursor for pagination: (block_number, log_index) from previous result
    #[deprecated(note = "Use get_announcements_cursor() for better performance")]
    pub async fn get_announcements(
        &self,
        from_block: Option<u64>,
        to_block: Option<u64>,
        view_tag: Option<u8>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Announcement>, StorageError> {
        let rows = sqlx::query_as::<_, AnnouncementRow>(
            r#"
            SELECT id, scheme_id, stealth_address, caller, ephemeral_pub_key,
                   metadata, view_tag, block_number, transaction_hash, log_index, created_at
            FROM announcements
            WHERE ($1::bigint IS NULL OR block_number >= $1)
              AND ($2::bigint IS NULL OR block_number <= $2)
              AND ($3::smallint IS NULL OR view_tag = $3)
            ORDER BY block_number DESC, log_index DESC
            LIMIT $4
            OFFSET $5
            "#,
        )
        .bind(from_block.map(|b| b as i64))
        .bind(to_block.map(|b| b as i64))
        .bind(view_tag.map(|v| v as i16))
        .bind(limit.unwrap_or(100))
        .bind(offset.unwrap_or(0))
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Announcement::from).collect())
    }

    /// Get announcements with cursor-based pagination (recommended)
    ///
    /// # Performance
    /// - O(1) regardless of page depth (vs O(n) for OFFSET)
    /// - Uses composite index on (block_number DESC, log_index DESC)
    ///
    /// # Arguments
    /// * `from_block` - Filter: block_number >= from_block
    /// * `to_block` - Filter: block_number <= to_block
    /// * `view_tag` - Filter: view_tag = view_tag
    /// * `limit` - Maximum number of results (default: 100)
    /// * `cursor` - Cursor from previous page: (block_number, log_index)
    ///              For first page, pass None
    pub async fn get_announcements_cursor(
        &self,
        from_block: Option<u64>,
        to_block: Option<u64>,
        view_tag: Option<u8>,
        limit: Option<i64>,
        cursor: Option<(u64, u32)>,
    ) -> Result<Vec<Announcement>, StorageError> {
        let rows = sqlx::query_as::<_, AnnouncementRow>(
            r#"
            SELECT id, scheme_id, stealth_address, caller, ephemeral_pub_key,
                   metadata, view_tag, block_number, transaction_hash, log_index, created_at
            FROM announcements
            WHERE ($1::bigint IS NULL OR block_number >= $1)
              AND ($2::bigint IS NULL OR block_number <= $2)
              AND ($3::smallint IS NULL OR view_tag = $3)
              AND (
                $4::bigint IS NULL
                OR (block_number, log_index) < ($4, $5)
              )
            ORDER BY block_number DESC, log_index DESC
            LIMIT $6
            "#,
        )
        .bind(from_block.map(|b| b as i64))
        .bind(to_block.map(|b| b as i64))
        .bind(view_tag.map(|v| v as i16))
        .bind(cursor.map(|(b, _)| b as i64))
        .bind(cursor.map(|(_, l)| l as i32).unwrap_or(0))
        .bind(limit.unwrap_or(100))
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(Announcement::from).collect())
    }

    /// Get announcement by stealth address
    pub async fn get_announcement_by_stealth_address(
        &self,
        stealth_address: &str,
    ) -> Result<Option<Announcement>, StorageError> {
        let row = sqlx::query_as::<_, AnnouncementRow>(
            r#"
            SELECT id, scheme_id, stealth_address, caller, ephemeral_pub_key,
                   metadata, view_tag, block_number, transaction_hash, log_index, created_at
            FROM announcements
            WHERE stealth_address = $1
            "#,
        )
        .bind(stealth_address)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(Announcement::from))
    }

    /// Save a registration
    pub async fn save_registration(
        &self,
        address: &str,
        scheme_id: u64,
        chain: &str,
        spending_pub_key: &str,
        viewing_pub_key: &str,
        signature: &str,
    ) -> Result<i64, StorageError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO registrations (
                address, scheme_id, chain, spending_pub_key, viewing_pub_key, signature
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (address, scheme_id) DO UPDATE
            SET chain = $3, spending_pub_key = $4, viewing_pub_key = $5,
                signature = $6, registered_at = NOW()
            RETURNING id
            "#,
        )
        .bind(address)
        .bind(scheme_id as i64)
        .bind(chain)
        .bind(spending_pub_key)
        .bind(viewing_pub_key)
        .bind(signature)
        .fetch_one(&self.pool)
        .await?;

        Ok(row.0)
    }

    /// Get registration by address
    pub async fn get_registration(
        &self,
        address: &str,
        scheme_id: Option<u64>,
    ) -> Result<Option<RegistrationRow>, StorageError> {
        let row = sqlx::query_as::<_, RegistrationRow>(
            r#"
            SELECT id, address, scheme_id, chain, spending_pub_key, viewing_pub_key,
                   signature, registered_at
            FROM registrations
            WHERE address = $1
              AND ($2::bigint IS NULL OR scheme_id = $2)
            ORDER BY registered_at DESC
            LIMIT 1
            "#,
        )
        .bind(address)
        .bind(scheme_id.map(|s| s as i64))
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    /// Get the latest processed block number from sync_state table
    ///
    /// # Performance
    /// Uses sync_state table (single row lookup) instead of MAX() aggregate
    /// which would require scanning the entire announcements table or index.
    pub async fn get_latest_block(&self) -> Result<Option<u64>, StorageError> {
        let row: Option<(i64,)> = sqlx::query_as(
            r#"
            SELECT last_block_number
            FROM sync_state
            WHERE id = 1
            "#,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.0 as u64).filter(|&b| b > 0))
    }

    /// Update the sync state with the latest processed block
    pub async fn update_sync_state(
        &self,
        block_number: u64,
        block_hash: Option<&str>,
    ) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE sync_state
            SET last_block_number = $1,
                last_block_hash = $2,
                updated_at = NOW()
            WHERE id = 1
            "#,
        )
        .bind(block_number as i64)
        .bind(block_hash)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get the latest processed block number using MAX() aggregate
    ///
    /// # Warning
    /// This is slower than get_latest_block() for large tables.
    /// Use only when sync_state may be out of sync.
    #[deprecated(note = "Use get_latest_block() which uses sync_state table")]
    pub async fn get_latest_block_from_announcements(&self) -> Result<Option<u64>, StorageError> {
        let row: Option<(Option<i64>,)> = sqlx::query_as(
            r#"
            SELECT MAX(block_number)
            FROM announcements
            "#,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.and_then(|r| r.0).map(|b| b as u64))
    }

    /// Get total announcement count (exact)
    ///
    /// # Warning
    /// For large tables (>1M rows), this can be slow.
    /// Consider using get_announcement_count_approx() for dashboards/monitoring.
    pub async fn get_announcement_count(&self) -> Result<i64, StorageError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*)
            FROM announcements
            "#,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.0)
    }

    /// Get approximate announcement count (fast)
    ///
    /// # Performance
    /// Uses pg_class.reltuples which is updated by VACUUM/ANALYZE.
    /// Returns approximate count in O(1) time vs O(n) for exact COUNT(*).
    /// Accuracy depends on how recently ANALYZE was run.
    ///
    /// # Use Cases
    /// - Dashboard statistics
    /// - Monitoring/alerting
    /// - UI where exact count isn't critical
    pub async fn get_announcement_count_approx(&self) -> Result<i64, StorageError> {
        let row: (f32,) = sqlx::query_as(
            r#"
            SELECT reltuples::float4
            FROM pg_class
            WHERE relname = 'announcements'
            "#,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.0 as i64)
    }

    /// Health check - verify database connectivity
    pub async fn health_check(&self) -> Result<(), StorageError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
