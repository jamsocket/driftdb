#!/bin/sh

cd js-pkg/driftdb
npm i
npm run build

cd ../driftdb-react
npm i
npm run build

cd ../../
npm ci
