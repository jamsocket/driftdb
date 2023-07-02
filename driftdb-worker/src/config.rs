use std::time::Duration;
use worker::{Env, RouteContext};

const HTTPS: &str = "HTTPS";
const RETENTION_SECONDS: &str = "RETENTION_SECONDS";
const PROTOCOL: &str = "PROTOCOL";

#[derive(Clone)]
pub struct Configuration {
    pub use_https: bool,
    pub retention: Duration,
}

impl Configuration {
    pub fn from_ctx(ctx: &RouteContext<()>) -> Configuration {
        let use_https = ctx
            .var(PROTOCOL)
            .map(|d| d.to_string().to_uppercase() == HTTPS)
            .unwrap_or(false);
        let retention = ctx
            .var(RETENTION_SECONDS)
            .ok()
            .map(|d| d.to_string())
            .and_then(|d| d.parse::<u64>().ok())
            .unwrap_or(60 * 60 * 24);
        let retention = Duration::from_secs(retention);

        Configuration {
            use_https,
            retention,
        }
    }

    pub fn from_env(ctx: &Env) -> Configuration {
        let use_https = ctx
            .var(PROTOCOL)
            .map(|d| d.to_string().to_uppercase() == HTTPS)
            .unwrap_or(false);
        let retention = ctx
            .var(RETENTION_SECONDS)
            .ok()
            .map(|d| d.to_string())
            .and_then(|d| d.parse::<u64>().ok())
            .unwrap_or(60 * 60 * 24);
        let retention = Duration::from_secs(retention);

        Configuration {
            use_https,
            retention,
        }
    }
}
