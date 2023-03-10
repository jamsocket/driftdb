This is a duplicate of driftdb (created by symlinking src/ and tsconfig.json) which is built
for workspace-internal use and cannot be published to npm.

This exists because bun does not play nicely with built typescript code in the same workspace.

`apps/tests/package.json` has a dependency on driftdb-internal, which is the only place it
is used.
