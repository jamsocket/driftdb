#!/bin/sh

set -e

cd driftdb-server

killall driftdb-server || true
cargo build
cargo run &

cd ../

cd js-pkg/

npm i
npx turbo build
npx turbo test
