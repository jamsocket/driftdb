## driftdb-server

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb-server)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb-server/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)
[![Chat on Discord](https://img.shields.io/static/v1?label=chat&message=discord&color=404eed)](https://discord.gg/N5sEpsuhh9)

[DriftDB](https://driftdb.com) is a is a real-time data backend that runs on the edge.

This crate implements a development server which implements the [DriftDB API](https://driftdb.com/docs/api).

Data are stored in memory and are not persisted beyond the life of the process. The server has no way of scaling beyond one node. As such, this should be treated as a development server or reference implementation.

To run:

    cargo run

The server will run on port 8080 by default. See the [DriftDB API docs](https://driftdb.com/docs/api) for instructions on how to use the API.
