## driftdb

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)
[![Chat on Discord](https://img.shields.io/static/v1?label=chat&message=discord&color=404eed)](https://discord.gg/N5sEpsuhh9)

[DriftDB](https://driftdb.com) is a is a real-time data backend that runs on the edge.

The underlying data structure in DriftDB is an in-memory ordered stream. This crate provides the core data structure, message format, and connection logic used by DriftDB.

This crate is used as a library for implementations of the [DriftDB API](https://driftdb.com/docs/api). It does not provide a full implementation (including an event loop and request serving), but implementations are available as [driftdb-server](https://crates.io/crates/driftdb-server) (a local dev server) and [driftdb-worker](https://crates.io/crates/driftdb-worker) (Cloudflare Worker implementation).
