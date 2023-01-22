use clap::Parser;
use std::net::IpAddr;
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
};
use crate::server::run_server;

mod server;

#[derive(Parser)]
pub struct Opts {
    #[clap(long, default_value = "8080")]
    port: u16,

    #[clap(long, default_value = "127.0.0.1")]
    host: IpAddr,
}

#[tokio::main]
async fn main() {
    // For some reason, without this the server will not start and exits immediately.
    println!("Starting server...");
    let opts = Opts::parse();

    let filter = EnvFilter::builder()
        .with_default_directive(LevelFilter::INFO.into())
        .from_env_lossy();
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();

    let result = run_server(&opts).await;
    tracing::error!(?result, "Server exited.");
}
