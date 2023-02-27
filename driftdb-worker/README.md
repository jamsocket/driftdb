## driftdb-worker

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb-worker)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb-worker/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)
[![Chat on Discord](https://img.shields.io/static/v1?label=chat&message=discord&color=404eed)](https://discord.gg/N5sEpsuhh9)

[DriftDB](https://driftdb.com) is a is a real-time data backend that runs on the edge.

This crate implements the [DriftDB API](https://driftdb.com/docs/api) on top of Cloudflare Durable Objects.

Usage requires `wrangler`, Cloudflare’s CLI tool.

To run locally:

    npm i
    npm run dev

Deploying to Cloudflare requires a Durable Objects subscription from Cloudflare. (If you just want to experiment with DriftDB, you can access a server for free at [jamsocket.live](https://jamsocket.live))

To deploy to Cloudflare:

    npm i
    npm run deploy

