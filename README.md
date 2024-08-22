# DriftDB

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)
[![Chat on Discord](https://img.shields.io/static/v1?label=chat&message=discord&color=404eed)](https://discord.gg/N5sEpsuhh9)

DriftDB is a real-time data backend for browser-based applications.

For more information, see [driftdb.com](https://driftdb.com).

## Local Development

### TypeScript libraries

To prepare the environment, install the dependencies and run a turborepo build:

    # from repo root
    cd js-pkg
    npm i
    npm run build

To run demos, run:

    # from repo root
    cd js-pkg/apps/demos
    npm run dev

To test the TypeScript libraries, first run a local development server:

    # from repo root
    cargo run -p driftdb-server

Then, with the local development server running:

    # from repo root
    cd js-pkg/packages/driftdb
    npm test

### Server

Server development requires the Rust toolchain (including `cargo`) to be installed.
Developing and deploying the `driftdb-worker` (Cloudflare worker) also requires Cloudflare's
Wrangler tool.

To run tests:

    # from repo root
    cargo test

To run a local development server:

    cargo run -p driftdb-server

For instructions on `driftdb-worker`, see `driftdb-worker/README.md`.

## Structure of this repo

- `docs/`: main online documentation and website for driftdb, available on the web at [driftdb.com](https://driftdb.com).
- `driftdb/`: core Rust driftdb implementation.
- `driftdb-server/`: Rust crate of driftdb dev server.
- `driftdb-worker/`: driftdb implementation on Cloudflare Workers.
- `js-pkg/`: JavaScript package root (turborepo monorepo).
    - `apps/demos/`: next.js project containing several demos, available on the web at [demos.driftdb.com](https://demos.driftdb.com).
    - `packages/driftdb/`: JavaScript client library for driftdb.
    - `packages/driftdb-react/`: Higher-level React hook-based interface to driftdb.
    - `packages/driftdb-ui/`: React-based debug UI for driftdb, available on the web at [ui.driftdb.com](https://ui.driftdb.com).
