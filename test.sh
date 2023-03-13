#!/bin/bash

set -e

BASE_DIR=$(dirname "$0" | xargs realpath)

cd ${BASE_DIR}/driftdb-server

killall driftdb-server 2> /dev/null || true
cargo build
cargo run &

cd ${BASE_DIR}/js-pkg/packages/driftdb
npm i
npm run build

cd ${BASE_DIR}/js-pkg/packages/driftdb-react
npm i
npm run build

cd ${BASE_DIR}/js-pkg/apps/tests
npm run test
