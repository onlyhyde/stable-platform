use actix_web::web;

use super::handlers;
use super::websocket;

/// Configure API routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            // Health & Stats (Kubernetes probes compatible)
            .route("/health", web::get().to(handlers::health))
            .route("/ready", web::get().to(handlers::ready))
            .route("/live", web::get().to(handlers::live))
            .route("/metrics", web::get().to(handlers::metrics))
            .route("/stats", web::get().to(handlers::get_stats))
            // Announcements
            .route("/announcements", web::get().to(handlers::get_announcements))
            .route(
                "/announcements/{stealth_address}",
                web::get().to(handlers::get_announcement_by_address),
            )
            // Registration
            .route("/register", web::post().to(handlers::register))
            .route(
                "/registrations/{address}",
                web::get().to(handlers::get_registration),
            )
            // Generate stealth address
            .route("/generate", web::post().to(handlers::generate))
            // Scan announcements (POST to protect viewing_private_key from URL/log exposure)
            .route("/scan", web::post().to(handlers::scan))
            // WebSocket
            .route("/ws", web::get().to(websocket::ws_handler)),
    );
}
