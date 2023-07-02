use crate::{
    config::Configuration,
    cors,
    state::{PersistedDb, WrappedState},
    websocket::WrappedWebSocket,
};
use driftdb::{Database, MessageFromDatabase, MessageToDatabase};
use std::collections::HashMap;
use tokio_stream::StreamExt;
use worker::{
    async_trait, console_warn, durable_object, js_sys, wasm_bindgen, wasm_bindgen_futures,
    worker_sys, Env, Method, Request, Response, Result, WebSocketPair, WebsocketEvent,
};

#[durable_object]
pub struct DbRoom {
    db: PersistedDb,
}

async fn receive_websocket_events(
    server: WrappedWebSocket,
    db: Database,
    debug: bool,
    state: WrappedState,
) {
    let mut event_stream = server.socket.events().expect("could not open stream");

    let conn = {
        let server = server.clone();
        let callback = move |message: &MessageFromDatabase| {
            server.send(message).expect("could not send message");
        };

        if debug {
            db.connect_debug(callback)
        } else {
            db.connect(callback)
        }
    };

    while let Some(event) = event_stream.next().await {
        match event.expect("received error in websocket") {
            WebsocketEvent::Message(msg) => {
                if let Some(text) = msg.text() {
                    if let Ok(message) = serde_json::from_str::<MessageToDatabase>(&text) {
                        // Reset the timeout for cleaning up the database.
                        state.bump_alarm().await.expect("Error bumping alarm");
                        conn.send_message(&message).unwrap();
                    } else {
                        server
                            .send(&MessageFromDatabase::Error {
                                message: format!("Could not decode message: {}", text),
                            })
                            .unwrap();
                    }
                } else if let Some(bytes) = msg.bytes() {
                    if let Ok(message) = ciborium::from_reader(bytes.as_slice()) {
                        // Reset the timeout for cleaning up the database.
                        state.bump_alarm().await.expect("Error bumping alarm");
                        conn.send_message(&message).unwrap();
                    } else {
                        server
                            .send(&MessageFromDatabase::Error {
                                message: format!("Could not decode message: {:?}", bytes),
                            })
                            .unwrap();
                    }
                } else {
                    console_warn!("Received unknown message type.");
                }
            }
            WebsocketEvent::Close(_) => {
                break;
            }
        }
    }
}

impl DbRoom {
    async fn connect(&mut self, req: Request) -> Result<Response> {
        let WebSocketPair { client, server } = WebSocketPair::new()?;
        server.accept()?;

        let db = self.db.get_db().await?;
        let state = self.db.state.clone();

        let url = req.url()?;

        let query: HashMap<String, String> = url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        let debug = query.get("debug").map(|s| !s.is_empty()).unwrap_or(false);
        let use_cbor = query.get("cbor").map(|s| !s.is_empty()).unwrap_or(false);

        let server = WrappedWebSocket::new(server, use_cbor);

        wasm_bindgen_futures::spawn_local(receive_websocket_events(server, db, debug, state));

        Response::from_websocket(client)?.with_cors(&cors())
    }
}

#[durable_object]
impl DurableObject for DbRoom {
    fn new(state: State, env: Env) -> Self {
        let configuration = Configuration::from_env(&env);
        Self {
            db: PersistedDb::new(state, configuration),
        }
    }

    async fn fetch(&mut self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        let (_, path) = url.path().rsplit_once('/').unwrap_or_default();
        let method = req.method();
        match (method, path) {
            (Method::Get, "connect") => self.connect(req).await,
            (Method::Post, "send") => {
                let db = self.db.get_db().await?;
                let conn = db.connect(|_| {});
                let message: MessageToDatabase = req.json().await?;
                let response = conn.send_message(&message)?;
                Response::from_json(&response)
            }
            _ => Response::error("Room command not found", 404),
        }
    }

    async fn alarm(&mut self) -> Result<Response> {
        self.db.cleanup().await?;

        Response::ok("ok")
    }
}
