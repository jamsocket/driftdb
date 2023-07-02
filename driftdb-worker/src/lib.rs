#![doc = include_str!("../README.md")]

use config::Configuration;
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use worker::Router;
use worker::{event, Cors, Env, Method, Request, Response, Result, RouteContext};

mod config;
mod dbroom;
mod state;
mod utils;
mod websocket;

const ROOM_ID_LENGTH: usize = 24;

pub fn cors() -> Cors {
    Cors::new()
        .with_methods(vec![Method::Post, Method::Get, Method::Options])
        .with_origins(vec!["*"])
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
        "http_url": format!("{}://{}/room/{}/send", http_protocol, host, room_id),
    }))?;

    Response::ok(response_body)
}

pub fn handle_room(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let configuration = Configuration::from_ctx(&ctx);
    if let Some(id) = ctx.param("room_id") {
        room_result(req, id, configuration.use_https)
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
    let configuration = Configuration::from_ctx(&ctx);
    let room_id = random_room_id(ROOM_ID_LENGTH);
    room_result(req, &room_id, configuration.use_https)
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
