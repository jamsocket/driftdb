#!/bin/bash

set -e

BASE_DIR=$(dirname "$0" | xargs realpath)

echo "Testing standalone server."

cd ${BASE_DIR}/driftdb-server
killall driftdb-server 2> /dev/null || true
cargo build
cargo run &
NATIVE_SERVER_PID=$!

echo "Testing Workers-based server."

cd ${BASE_DIR}/js-pkg/packages/driftdb
npm ci --include=dev
npm test -- --forceExit --detectOpenHandles

kill ${NATIVE_SERVER_PID}

cd ${BASE_DIR}/driftdb-worker
npm ci
npm run dev &
WORKER_SERVER_PID=$!

# Wait for the server to start. Give up after 30 seconds.
ok=0
for i in {1..60}; do
  if curl -s http://127.0.0.1:8787 > /dev/null; then
    ok=1
    break
  fi
  echo "Waiting for server to start..."
  sleep 1
done

if [ $ok -eq 0 ]; then
  echo "Server failed to start."
  exit 1
fi

cd ${BASE_DIR}/js-pkg/packages/driftdb
DRIFTDB_API=http://127.0.0.1:8787 npm test -- --forceExit --detectOpenHandles

kill ${WORKER_SERVER_PID}
