use actix_web::{web, App, HttpServer};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod config;
mod domain;
mod parser;
mod storage;
mod subscriber;

use api::{configure_routes, AnnouncementBroadcaster};
use config::Config;
use parser::AnnouncementParser;
use storage::Storage;
use subscriber::{IndexerClient, IndexerEvent};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "stealth_server=debug,actix_web=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Set root span with service metadata for structured logging
    let _root_span =
        tracing::info_span!("", service = "stealth-server", version = "1.0.0").entered();

    info!("Starting stealth-server...");

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");
    info!("Configuration loaded: {:?}", config);

    // Initialize storage
    let storage = Storage::new(&config.database)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    if let Err(e) = storage.migrate().await {
        warn!("Migration failed (may already be applied): {:?}", e);
    }

    let storage = web::Data::new(storage);

    // Initialize announcement broadcaster
    let broadcaster = AnnouncementBroadcaster::new(1000);
    let broadcaster_data = web::Data::new(broadcaster.clone());

    // Create event channel
    let (event_tx, mut event_rx) = mpsc::channel::<IndexerEvent>(1000);

    // Start indexer client
    let indexer_client = Arc::new(IndexerClient::new(
        config.indexer.clone(),
        config.stealth.announcer_address.clone(),
        event_tx,
    ));
    let indexer_client_clone = indexer_client.clone();
    tokio::spawn(async move {
        indexer_client_clone.start().await;
    });

    // Start event processor
    let storage_clone = storage.clone();
    let broadcaster_clone = broadcaster.clone();
    tokio::spawn(async move {
        info!("Event processor started");
        while let Some(event) = event_rx.recv().await {
            match event {
                IndexerEvent::Log(log) => {
                    // Parse announcement
                    match AnnouncementParser::parse(&log) {
                        Ok(announcement) => {
                            info!(
                                "Received announcement: stealth_address={}, block={}",
                                announcement.stealth_address, announcement.block_number
                            );

                            // Save to database
                            if let Err(e) = storage_clone.save_announcement(&announcement).await {
                                error!("Failed to save announcement: {:?}", e);
                            }

                            // Broadcast to WebSocket clients
                            broadcaster_clone.broadcast(announcement);
                        }
                        Err(e) => {
                            warn!("Failed to parse announcement: {:?}", e);
                        }
                    }
                }
                IndexerEvent::Connected { subscription_id } => {
                    info!("Connected to indexer with subscription: {}", subscription_id);
                }
                IndexerEvent::Error { message } => {
                    error!("Indexer error: {}", message);
                }
                _ => {}
            }
        }
    });

    // Start HTTP server
    let server_config = config.server.clone();
    info!(
        "Starting HTTP server on {}:{}",
        server_config.host, server_config.port
    );

    HttpServer::new(move || {
        App::new()
            .app_data(storage.clone())
            .app_data(broadcaster_data.clone())
            .wrap(tracing_actix_web::TracingLogger::default())
            .configure(configure_routes)
    })
    .bind((server_config.host, server_config.port))?
    .run()
    .await
}
