use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};

use crate::domain::{generate_stealth_address, scheme, verify_registration_signature, StealthMetaAddress};
use crate::storage::Storage;

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
    pub timestamp: String,
}

/// Ready check response
#[derive(Serialize)]
pub struct ReadyResponse {
    pub ready: bool,
    pub service: String,
}

/// Live check response
#[derive(Serialize)]
pub struct LiveResponse {
    pub alive: bool,
    pub service: String,
}

/// Health check endpoint (Kubernetes probes compatible)
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(),
        service: "stealth-server".to_string(),
        version: "1.0.0".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

/// Ready check endpoint
pub async fn ready(storage: web::Data<Storage>) -> impl Responder {
    // Service is ready if we can access storage
    let ready = storage.get_announcement_count().await.is_ok();

    if ready {
        HttpResponse::Ok().json(ReadyResponse {
            ready: true,
            service: "stealth-server".to_string(),
        })
    } else {
        HttpResponse::ServiceUnavailable().json(ReadyResponse {
            ready: false,
            service: "stealth-server".to_string(),
        })
    }
}

/// Live check endpoint
pub async fn live() -> impl Responder {
    HttpResponse::Ok().json(LiveResponse {
        alive: true,
        service: "stealth-server".to_string(),
    })
}

/// Prometheus metrics endpoint
pub async fn metrics(storage: web::Data<Storage>) -> impl Responder {
    let announcement_count = storage.get_announcement_count().await.unwrap_or(0);
    let latest_block = storage.get_latest_block().await.unwrap_or(None).unwrap_or(0);

    let metrics = format!(
        r#"# HELP stealth_server_up Service up status
# TYPE stealth_server_up gauge
stealth_server_up{{service="stealth-server"}} 1
# HELP stealth_server_announcements_total Total announcements indexed
# TYPE stealth_server_announcements_total gauge
stealth_server_announcements_total{{service="stealth-server"}} {}
# HELP stealth_server_latest_block Latest processed block
# TYPE stealth_server_latest_block gauge
stealth_server_latest_block{{service="stealth-server"}} {}
"#,
        announcement_count, latest_block
    );

    HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .body(metrics)
}

/// Stats response
#[derive(Serialize)]
pub struct StatsResponse {
    pub announcement_count: i64,
    pub latest_block: Option<u64>,
}

/// Get server stats
pub async fn get_stats(storage: web::Data<Storage>) -> impl Responder {
    let count = storage.get_announcement_count().await.unwrap_or(0);
    let latest_block = storage.get_latest_block().await.unwrap_or(None);

    HttpResponse::Ok().json(StatsResponse {
        announcement_count: count,
        latest_block,
    })
}

/// Announcements query parameters (cursor-based pagination)
#[derive(Debug, Deserialize)]
pub struct AnnouncementsQuery {
    pub from_block: Option<u64>,
    pub to_block: Option<u64>,
    pub view_tag: Option<u8>,
    pub limit: Option<i64>,
    /// Cursor for pagination: block_number from last result
    /// For first page, omit this parameter
    pub cursor_block: Option<u64>,
    /// Cursor for pagination: log_index from last result
    /// Required if cursor_block is provided
    pub cursor_log_index: Option<u32>,
}

/// Announcements response with cursor for next page
#[derive(Serialize)]
pub struct AnnouncementsResponse {
    pub announcements: Vec<crate::parser::Announcement>,
    pub total: usize,
    /// Cursor for next page: use these values in cursor_block and cursor_log_index
    /// If None, this is the last page
    pub next_cursor: Option<AnnouncementCursor>,
}

/// Cursor for pagination
#[derive(Serialize)]
pub struct AnnouncementCursor {
    pub block_number: u64,
    pub log_index: u32,
}

/// Get announcements with cursor-based pagination
///
/// # Performance
/// Uses cursor-based pagination for O(1) performance regardless of page depth.
/// OFFSET-based pagination is deprecated as it degrades performance on deep pages.
///
/// # Usage
/// - First request: omit cursor_block and cursor_log_index
/// - Next page: use next_cursor values from previous response
pub async fn get_announcements(
    storage: web::Data<Storage>,
    query: web::Query<AnnouncementsQuery>,
) -> impl Responder {
    // Build cursor from query params
    let cursor = match (query.cursor_block, query.cursor_log_index) {
        (Some(block), Some(log_index)) => Some((block, log_index)),
        (Some(block), None) => Some((block, 0)), // Default log_index to 0
        _ => None,
    };

    match storage
        .get_announcements_cursor(
            query.from_block,
            query.to_block,
            query.view_tag,
            query.limit,
            cursor,
        )
        .await
    {
        Ok(announcements) => {
            let total = announcements.len();

            // Build next cursor from last announcement
            let next_cursor = announcements.last().map(|a| AnnouncementCursor {
                block_number: a.block_number,
                log_index: a.log_index,
            });

            HttpResponse::Ok().json(AnnouncementsResponse {
                announcements,
                total,
                next_cursor,
            })
        }
        Err(e) => {
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string()
            }))
        }
    }
}

/// Get announcement by stealth address
pub async fn get_announcement_by_address(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> impl Responder {
    let stealth_address = path.into_inner();

    match storage.get_announcement_by_stealth_address(&stealth_address).await {
        Ok(Some(announcement)) => HttpResponse::Ok().json(announcement),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Announcement not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// Registration request
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub address: String,
    pub stealth_meta_address: String,
    pub signature: String,
    #[serde(default = "default_scheme_id")]
    pub scheme_id: u64,
}

fn default_scheme_id() -> u64 {
    scheme::SECP256K1
}

/// Registration response
#[derive(Serialize)]
pub struct RegisterResponse {
    pub success: bool,
    pub id: i64,
}

/// Register a stealth meta-address
pub async fn register(
    storage: web::Data<Storage>,
    body: web::Json<RegisterRequest>,
) -> impl Responder {
    // Parse the stealth meta-address
    let meta_address = match StealthMetaAddress::parse(&body.stealth_meta_address) {
        Ok(addr) => addr,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Invalid stealth meta-address: {}", e)
            }));
        }
    };

    // Verify signature - ensure the registration request was signed by the claimed address
    if let Err(e) = verify_registration_signature(
        &body.address,
        &body.stealth_meta_address,
        &body.signature,
    ) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Signature verification failed: {}", e)
        }));
    }

    // Save registration
    match storage
        .save_registration(
            &body.address,
            body.scheme_id,
            &meta_address.chain,
            &meta_address.spending_pub_key,
            &meta_address.viewing_pub_key,
            &body.signature,
        )
        .await
    {
        Ok(id) => HttpResponse::Ok().json(RegisterResponse { success: true, id }),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// Get registration by address
pub async fn get_registration(
    storage: web::Data<Storage>,
    path: web::Path<String>,
) -> impl Responder {
    let address = path.into_inner();

    match storage.get_registration(&address, None).await {
        Ok(Some(reg)) => {
            let meta = StealthMetaAddress {
                chain: reg.chain,
                spending_pub_key: reg.spending_pub_key,
                viewing_pub_key: reg.viewing_pub_key,
            };
            HttpResponse::Ok().json(serde_json::json!({
                "address": reg.address,
                "scheme_id": reg.scheme_id,
                "stealth_meta_address": meta.to_uri(),
                "registered_at": reg.registered_at,
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Registration not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

/// Generate stealth address request
#[derive(Debug, Deserialize)]
pub struct GenerateRequest {
    pub stealth_meta_address: String,
}

/// Generate stealth address response
#[derive(Serialize)]
pub struct GenerateResponse {
    pub stealth_address: String,
    pub ephemeral_pub_key: String,
    pub view_tag: u8,
}

/// Generate a stealth address from a meta-address
pub async fn generate(body: web::Json<GenerateRequest>) -> impl Responder {
    // Parse the stealth meta-address
    let meta_address = match StealthMetaAddress::parse(&body.stealth_meta_address) {
        Ok(addr) => addr,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Invalid stealth meta-address: {}", e)
            }));
        }
    };

    // Generate stealth address
    match generate_stealth_address(&meta_address.spending_pub_key, &meta_address.viewing_pub_key) {
        Ok((stealth_address, ephemeral_pub_key, view_tag)) => {
            HttpResponse::Ok().json(GenerateResponse {
                stealth_address,
                ephemeral_pub_key,
                view_tag,
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to generate stealth address: {}", e)
        })),
    }
}

/// Scan request - filter announcements by viewing key
/// Uses POST to prevent private key exposure in URL/logs
#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    pub viewing_private_key: String,
    pub from_block: Option<u64>,
    pub to_block: Option<u64>,
    pub limit: Option<i64>,
    /// Cursor for pagination
    pub cursor_block: Option<u64>,
    pub cursor_log_index: Option<u32>,
}

/// Scan response with cursor
#[derive(Serialize)]
pub struct ScanResponse {
    pub announcements: Vec<crate::parser::Announcement>,
    pub total: usize,
    pub next_cursor: Option<AnnouncementCursor>,
}

/// Scan for announcements matching a viewing key
/// POST endpoint to prevent viewing_private_key exposure in URL/server logs
pub async fn scan(
    storage: web::Data<Storage>,
    body: web::Json<ScanRequest>,
) -> impl Responder {
    // Build cursor from request body
    let cursor = match (body.cursor_block, body.cursor_log_index) {
        (Some(block), Some(log_index)) => Some((block, log_index)),
        (Some(block), None) => Some((block, 0)),
        _ => None,
    };

    // First get announcements with cursor-based pagination
    let announcements = match storage
        .get_announcements_cursor(body.from_block, body.to_block, None, body.limit, cursor)
        .await
    {
        Ok(a) => a,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string()
            }));
        }
    };

    // Build cursor for next page from last announcement (before filtering)
    let next_cursor = announcements.last().map(|a| AnnouncementCursor {
        block_number: a.block_number,
        log_index: a.log_index,
    });

    // Filter by view tag matching
    let mut matches = Vec::new();
    for announcement in announcements {
        if let Some(view_tag) = announcement.view_tag {
            match crate::domain::check_view_tag(
                &announcement.ephemeral_pub_key,
                &body.viewing_private_key,
                view_tag,
            ) {
                Ok(true) => matches.push(announcement),
                Ok(false) => continue,
                Err(_) => continue, // Skip on error
            }
        }
    }

    HttpResponse::Ok().json(ScanResponse {
        total: matches.len(),
        announcements: matches,
        next_cursor,
    })
}
