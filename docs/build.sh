#!/bin/bash

set -e

DOCS_DIR=$(dirname "$0" | xargs realpath)

rm -rf "${DOCS_DIR}/.docusaurus"
rm -rf "${DOCS_DIR}/docs/react-api"
rm -rf "${DOCS_DIR}/docs/vanilla-api"

cd ${DOCS_DIR}/../js-pkg/packages/driftdb
npm i
npm run build

cd ${DOCS_DIR}/../js-pkg/packages/driftdb-react
npm i

cd "${DOCS_DIR}"
npm i
npm run build
