#!/bin/sh

set -e

npm ci || npm ci # long story

cd driftdb-server

killall driftdb-server || true
cargo build
cargo run &

cd ../

cd js-pkg/tests

npm test

