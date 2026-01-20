use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};

use crate::domain::{generate_stealth_address, scheme, StealthMetaAddress};
use crate::storage::Storage;

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
}

/// Health check endpoint
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(),
        service: "stealth-server".to_string(),
    })
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

/// Announcements query parameters
#[derive(Debug, Deserialize)]
pub struct AnnouncementsQuery {
    pub from_block: Option<u64>,
    pub to_block: Option<u64>,
    pub view_tag: Option<u8>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Announcements response
#[derive(Serialize)]
pub struct AnnouncementsResponse {
    pub announcements: Vec<crate::parser::Announcement>,
    pub total: usize,
}

/// Get announcements
pub async fn get_announcements(
    storage: web::Data<Storage>,
    query: web::Query<AnnouncementsQuery>,
) -> impl Responder {
    match storage
        .get_announcements(
            query.from_block,
            query.to_block,
            query.view_tag,
            query.limit,
            query.offset,
        )
        .await
    {
        Ok(announcements) => {
            let total = announcements.len();
            HttpResponse::Ok().json(AnnouncementsResponse {
                announcements,
                total,
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

    // TODO: Verify signature

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
#[derive(Debug, Deserialize)]
pub struct ScanQuery {
    pub viewing_private_key: String,
    pub from_block: Option<u64>,
    pub to_block: Option<u64>,
    pub limit: Option<i64>,
}

/// Scan for announcements matching a viewing key
pub async fn scan(
    storage: web::Data<Storage>,
    query: web::Query<ScanQuery>,
) -> impl Responder {
    // First get all announcements with view tags
    let announcements = match storage
        .get_announcements(query.from_block, query.to_block, None, query.limit, None)
        .await
    {
        Ok(a) => a,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string()
            }));
        }
    };

    // Filter by view tag matching
    let mut matches = Vec::new();
    for announcement in announcements {
        if let Some(view_tag) = announcement.view_tag {
            match crate::domain::check_view_tag(
                &announcement.ephemeral_pub_key,
                &query.viewing_private_key,
                view_tag,
            ) {
                Ok(true) => matches.push(announcement),
                Ok(false) => continue,
                Err(_) => continue, // Skip on error
            }
        }
    }

    HttpResponse::Ok().json(AnnouncementsResponse {
        total: matches.len(),
        announcements: matches,
    })
}
