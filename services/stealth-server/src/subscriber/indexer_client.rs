use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::config::IndexerConfig;

/// Event received from indexer-go
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum IndexerEvent {
    Log(LogEvent),
    Transaction(TransactionEvent),
    Block(BlockEvent),
    Connected { subscription_id: String },
    Error { message: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct LogEvent {
    pub address: String,
    pub topics: Vec<String>,
    pub data: String,
    pub block_number: u64,
    pub transaction_hash: String,
    pub transaction_index: u32,
    pub log_index: u32,
    pub removed: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TransactionEvent {
    pub hash: String,
    pub from: String,
    pub to: Option<String>,
    pub value: String,
    pub input: String,
    pub block_number: u64,
    pub block_hash: String,
    pub gas_used: u64,
    pub status: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BlockEvent {
    pub number: u64,
    pub hash: String,
    pub parent_hash: String,
    pub timestamp: u64,
    pub transaction_count: usize,
}

/// Subscription request to indexer-go
#[derive(Debug, Serialize)]
struct SubscribeRequest {
    action: String,
    #[serde(rename = "type")]
    event_type: String,
    filter: SubscriptionFilter,
}

#[derive(Debug, Serialize)]
struct SubscriptionFilter {
    addresses: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    topics: Option<Vec<Vec<String>>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    from_block: Option<u64>,
}

/// Client for connecting to indexer-go WebSocket
pub struct IndexerClient {
    config: IndexerConfig,
    contract_address: String,
    event_tx: mpsc::Sender<IndexerEvent>,
}

impl IndexerClient {
    pub fn new(
        config: IndexerConfig,
        contract_address: String,
        event_tx: mpsc::Sender<IndexerEvent>,
    ) -> Self {
        Self {
            config,
            contract_address,
            event_tx,
        }
    }

    /// Start the indexer client with automatic reconnection
    pub async fn start(self: Arc<Self>) {
        loop {
            match self.connect_and_subscribe().await {
                Ok(_) => {
                    info!("IndexerClient connection closed, reconnecting...");
                }
                Err(e) => {
                    error!("IndexerClient error: {:?}", e);
                }
            }

            let reconnect_duration = Duration::from_millis(self.config.reconnect_interval_ms);
            warn!("Reconnecting in {:?}...", reconnect_duration);
            sleep(reconnect_duration).await;
        }
    }

    async fn connect_and_subscribe(&self) -> anyhow::Result<()> {
        info!("Connecting to indexer at {}", self.config.websocket_url);

        let (ws_stream, _) = connect_async(&self.config.websocket_url).await?;
        let (mut write, mut read) = ws_stream.split();

        info!("Connected to indexer, subscribing to contract {}", self.contract_address);

        // Subscribe to log events for the stealth announcer contract
        // Topic[0] = Announcement event signature
        let announcement_topic = "0x5f0eab0a76a3dafb20eb8e3a71c9f28235b81829d63f9e47b2754f4c605209e6";

        let subscribe_request = SubscribeRequest {
            action: "subscribe".to_string(),
            event_type: "log".to_string(),
            filter: SubscriptionFilter {
                addresses: vec![self.contract_address.clone()],
                topics: Some(vec![vec![announcement_topic.to_string()]]),
                from_block: None,
            },
        };

        let msg = serde_json::to_string(&subscribe_request)?;
        write.send(Message::Text(msg)).await?;

        info!("Subscription request sent, waiting for events...");

        // Process incoming messages
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    match serde_json::from_str::<IndexerEvent>(&text) {
                        Ok(event) => {
                            if let Err(e) = self.event_tx.send(event).await {
                                error!("Failed to send event to channel: {:?}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            warn!("Failed to parse indexer event: {:?}, raw: {}", e, text);
                        }
                    }
                }
                Ok(Message::Ping(data)) => {
                    if let Err(e) = write.send(Message::Pong(data)).await {
                        error!("Failed to send pong: {:?}", e);
                        break;
                    }
                }
                Ok(Message::Close(_)) => {
                    info!("WebSocket closed by server");
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {:?}", e);
                    break;
                }
                _ => {}
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_log_event() {
        let json = r#"{
            "type": "log",
            "address": "0x55649E01B5Df198D18D95b5cc5051630cfD45564",
            "topics": [
                "0x5f0eab0a76a3dafb20eb8e3a71c9f28235b81829d63f9e47b2754f4c605209e6",
                "0x0000000000000000000000000000000000000000000000000000000000000001"
            ],
            "data": "0x1234",
            "block_number": 100,
            "transaction_hash": "0xabc",
            "transaction_index": 0,
            "log_index": 0,
            "removed": false
        }"#;

        let event: IndexerEvent = serde_json::from_str(json).unwrap();
        match event {
            IndexerEvent::Log(log) => {
                assert_eq!(log.block_number, 100);
                assert_eq!(log.topics.len(), 2);
            }
            _ => panic!("Expected LogEvent"),
        }
    }
}
