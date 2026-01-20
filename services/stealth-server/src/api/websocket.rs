use actix::{Actor, ActorContext, AsyncContext, Handler, Message, StreamHandler};
use actix_web::{web, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use tracing::{debug, info};

use crate::parser::Announcement;

/// Heartbeat interval
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
/// Client timeout
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

/// WebSocket message types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    /// Subscribe to announcements with optional view tag filter
    Subscribe { view_tag: Option<u8> },
    /// Unsubscribe from announcements
    Unsubscribe,
    /// Announcement notification
    Announcement(Announcement),
    /// Ping/Pong for keepalive
    Ping,
    Pong,
    /// Error message
    Error { message: String },
}

/// Message for broadcasting announcements
#[derive(Clone, Message)]
#[rtype(result = "()")]
pub struct BroadcastAnnouncement(pub Announcement);

/// WebSocket actor
pub struct WsSession {
    /// Last heartbeat
    hb: Instant,
    /// Optional view tag filter
    view_tag_filter: Option<u8>,
    /// Broadcast receiver
    rx: Option<broadcast::Receiver<Announcement>>,
}

impl WsSession {
    pub fn new(rx: broadcast::Receiver<Announcement>) -> Self {
        WsSession {
            hb: Instant::now(),
            view_tag_filter: None,
            rx: Some(rx),
        }
    }

    /// Start heartbeat process
    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                info!("WebSocket client heartbeat failed, disconnecting");
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);

        // Spawn task to receive broadcast messages
        if let Some(mut rx) = self.rx.take() {
            let addr = ctx.address();
            actix::spawn(async move {
                while let Ok(announcement) = rx.recv().await {
                    addr.do_send(BroadcastAnnouncement(announcement));
                }
            });
        }

        info!("WebSocket session started");
    }
}

impl Handler<BroadcastAnnouncement> for WsSession {
    type Result = ();

    fn handle(&mut self, msg: BroadcastAnnouncement, ctx: &mut Self::Context) {
        let announcement = msg.0;

        // Apply view tag filter if set
        if let Some(filter_tag) = self.view_tag_filter {
            if let Some(view_tag) = announcement.view_tag {
                if view_tag != filter_tag {
                    return;
                }
            } else {
                return;
            }
        }

        let ws_msg = WsMessage::Announcement(announcement);
        if let Ok(json) = serde_json::to_string(&ws_msg) {
            ctx.text(json);
        }
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                self.hb = Instant::now();
                ctx.pong(&msg);
            }
            Ok(ws::Message::Pong(_)) => {
                self.hb = Instant::now();
            }
            Ok(ws::Message::Text(text)) => {
                self.hb = Instant::now();

                match serde_json::from_str::<WsMessage>(&text) {
                    Ok(WsMessage::Subscribe { view_tag }) => {
                        debug!("Client subscribed with view_tag filter: {:?}", view_tag);
                        self.view_tag_filter = view_tag;
                    }
                    Ok(WsMessage::Unsubscribe) => {
                        debug!("Client unsubscribed");
                        self.view_tag_filter = None;
                    }
                    Ok(WsMessage::Ping) => {
                        let response = WsMessage::Pong;
                        if let Ok(json) = serde_json::to_string(&response) {
                            ctx.text(json);
                        }
                    }
                    _ => {
                        let error = WsMessage::Error {
                            message: "Unknown message type".to_string(),
                        };
                        if let Ok(json) = serde_json::to_string(&error) {
                            ctx.text(json);
                        }
                    }
                }
            }
            Ok(ws::Message::Binary(_)) => {
                debug!("Binary messages not supported");
            }
            Ok(ws::Message::Close(reason)) => {
                info!("WebSocket closing: {:?}", reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }
}

/// Announcement broadcaster
#[derive(Clone)]
pub struct AnnouncementBroadcaster {
    tx: broadcast::Sender<Announcement>,
}

impl AnnouncementBroadcaster {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        AnnouncementBroadcaster { tx }
    }

    /// Subscribe to announcements
    pub fn subscribe(&self) -> broadcast::Receiver<Announcement> {
        self.tx.subscribe()
    }

    /// Broadcast an announcement
    pub fn broadcast(&self, announcement: Announcement) {
        let _ = self.tx.send(announcement);
    }
}

/// WebSocket handler
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    broadcaster: web::Data<AnnouncementBroadcaster>,
) -> Result<HttpResponse, actix_web::Error> {
    let rx = broadcaster.subscribe();
    ws::start(WsSession::new(rx), &req, stream)
}
