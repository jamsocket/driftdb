use driftdb::types::key_seq_pair::KeyAndSeq;
use driftdb::{
    ApplyResult, Database, DeleteInstruction, MessageFromDatabase, MessageToDatabase,
    PushInstruction,
};
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use std::collections::HashMap;
use tokio_stream::StreamExt;
use worker::{
    async_trait, durable_object, event, js_sys, wasm_bindgen, wasm_bindgen_futures, worker_sys,
    Cors, Env, Method, Request, Response, Result, RouteContext, WebSocket, WebSocketPair, State, console_log,
};
use worker::{ListOptions, Router, WebsocketEvent};

use crate::state::PersistedDb;

mod state;
mod utils;

pub fn cors() -> Cors {
    Cors::new()
        .with_methods(vec![Method::Post, Method::Get, Method::Options])
        .with_origins(vec!["*"])
}

fn use_http(ctx: &RouteContext<()>) -> bool {
    let Ok(protocol) = ctx.var("PROTOCOL") else { return false };
    protocol.to_string() == "HTTP"
}

fn room_result(req: Request, room_id: &str, use_https: bool) -> Result<Response> {
    let host = req
        .headers()
        .get("Host")?
        .ok_or_else(|| worker::Error::JsError("No Host header provided.".to_string()))?;

    let ws_protocol = if use_https { "wss" } else { "ws" };
    let http_protocol = if use_https { "https" } else { "http" };

    let response_body = serde_json::to_string(&serde_json::json!({
        "room": room_id,
        "socket_url": format!("{}://{}/room/{}/connect", ws_protocol, host, room_id),
        "http_url": format!("{}://{}/room/{}/", http_protocol, host, room_id),
    }))?;

    Response::ok(response_body)
}

pub fn handle_room(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(id) = ctx.param("room_id") {
        room_result(req, id, !use_http(&ctx))
    } else {
        Response::error("Bad Request", 400)
    }
}

/// Generate a random alphanumeric room ID.
fn random_room_id(length: usize) -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

pub fn handle_new_room(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let room_id = random_room_id(24);
    room_result(req, &room_id, !use_http(&ctx))
}

pub async fn handle_room_request(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    if let Some(id) = ctx.param("room_id") {
        let namespace = ctx.durable_object("DATABASE")?;
        let stub = namespace.id_from_name(id)?.get_stub()?;
        stub.fetch_with_request(req).await
    } else {
        Response::error("Bad Request", 400)
    }
}

#[cfg(feature = "fetch-event")]
#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: worker::Context) -> Result<Response> {
    utils::set_panic_hook();
    let router = Router::new();

    let response = router
        .get("/", |_, _| Response::ok("DriftDB Worker service."))
        .post("/new", handle_new_room)
        .get("/room/:room_id", handle_room)
        .on_async("/room/:room_id/:handler", handle_room_request)
        .run(req, env)
        .await?;

    response.with_cors(&cors())
}

#[durable_object]
pub struct DbRoom {
    state: Option<State>,
    db: Option<Database>,
}

/// A raw WebSocket is not Send or Sync, but that doesn't matter because we are compiling
/// to WebAssembly, which is single-threaded, so we wrap it in a newtype struct which
/// implements Send and Sync.
struct WrappedWebSocket(WebSocket);
unsafe impl Send for WrappedWebSocket {}
unsafe impl Sync for WrappedWebSocket {}

impl DbRoom {
    async fn get_db(&mut self) -> Result<Database> {
        if let Some(db) = &self.db {
            return Ok(db.clone());
        }
        let state = self.state.take().expect("Exactly one of db or state should not be None.");
        let state = PersistedDb(state);
        let result = state.load_store().await;

        let mut db = match result {
            Ok(store) => Database::new_from_store(store),
            Err(e) => {
                console_log!("Error loading store: {}", e);
                Database::new()
            }
        };

        {
            db.set_replica_callback(move |apply_result: &ApplyResult| {
                let mut storage = state.0.storage();
                let apply_result = apply_result.clone();

                wasm_bindgen_futures::spawn_local(async move {
                    if let Some(delete_instruction) = &apply_result.delete_instruction {
                        match delete_instruction {
                            DeleteInstruction::Delete => {
                                let prefix = KeyAndSeq::prefix_str(&apply_result.key);
                                let list_options = ListOptions::new().prefix(&prefix);

                                let result = storage.list_with_options(list_options).await;

                                if let Ok(keys) = result {
                                    let keys: Vec<String> = keys
                                        .keys()
                                        .into_iter()
                                        .map(|d| d.unwrap().as_string().unwrap())
                                        .collect();
                                    storage
                                        .delete_multiple(keys)
                                        .await
                                        .expect("Error deleting keys.");
                                }
                            }
                            DeleteInstruction::DeleteUpTo(seq) => {
                                let prefix = KeyAndSeq::prefix_str(&apply_result.key);
                                let end = KeyAndSeq::new(apply_result.key.clone(), seq.next()).to_string();
                                let list_options = ListOptions::new().prefix(&prefix).end(&end);
                                let result = storage.list_with_options(list_options).await;

                                if let Ok(keys) = result {
                                    let keys: Vec<String> = keys
                                        .keys()
                                        .into_iter()
                                        .map(|d| d.unwrap().as_string().unwrap())
                                        .collect();
                                    storage
                                        .delete_multiple(keys)
                                        .await
                                        .expect("Error deleting keys.");
                                }
                            }
                        }
                    }

                    if let Some(push_instruction) = &apply_result.push_instruction {
                        let sequence_value = match push_instruction {
                            PushInstruction::Push(sequence_value) => sequence_value,
                            PushInstruction::PushStart(sequence_value) => sequence_value,
                        };

                        let storage_key = KeyAndSeq::new(
                            apply_result.key.clone(),
                            sequence_value.seq,
                        ).to_string();

                        let storage_value = serde_json::to_string(&sequence_value.value).unwrap();

                        storage
                            .put(&storage_key, &storage_value)
                            .await
                            .expect("Error putting value in storage.");
                    }
                });
            });
        }

        self.db = Some(db);
        Ok(self.db.clone().unwrap())
    }

    async fn connect(&mut self, req: Request) -> Result<Response> {
        let WebSocketPair { client, server } = WebSocketPair::new()?;
        server.accept()?;

        let db = self.get_db().await?;

        let url = req.url()?;

        let query: HashMap<String, String> = url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();

        let debug = query.get("debug").map(|s| s == "true").unwrap_or(false);

        wasm_bindgen_futures::spawn_local(async move {
            let mut event_stream = server.events().expect("could not open stream");

            let conn = {
                let server = WrappedWebSocket(server.clone());
                let callback = move |message: &MessageFromDatabase| {
                    server
                        .0
                        .send_with_str(
                            serde_json::to_string(&message).expect("Could not encode message."),
                        )
                        .expect("could not send message");
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
                                conn.send_message(&message).unwrap();
                            } else {
                                server
                                    .send_with_str(
                                        &serde_json::to_string(&MessageFromDatabase::Error {
                                            message: format!("Could not decode message: {}", text),
                                        })
                                        .unwrap(),
                                    )
                                    .unwrap();
                            }
                        }
                    }
                    WebsocketEvent::Close(_) => {
                        break;
                    }
                }
            }
        });

        Response::from_websocket(client)?.with_cors(&cors())
    }
}

#[durable_object]
impl DurableObject for DbRoom {
    fn new(state: State, _: Env) -> Self {
        Self {
            state: Some(state),
            db: None,
        }
    }

    async fn fetch(&mut self, mut req: Request) -> Result<Response> {
        let url = req.url()?;
        let (_, path) = url.path().rsplit_once('/').unwrap_or_default();
        let method = req.method();
        match (method, path) {
            (Method::Get, "connect") => self.connect(req).await,
            (Method::Post, "send") => {
                let db = self.get_db().await?;
                let message: MessageToDatabase = req.json().await?;
                let response = db.send_message(&message);
                Response::from_json(&response)
            }
            _ => Response::error("Room command not found", 404),
        }
    }
}
