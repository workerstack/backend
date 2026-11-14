---
name: bun-child-auto-installs-npm
paths: ["packages/core/src/build/init.test.ts", "packages/core/src/build/**"]
evidence: ["plan 58"]
---

# A spawned Bun child loads the published package, not the source

A test that spawns `bun -e` in a scratch project served the npm rc.26 build of `@workerstack/backend`.

## Mistake
The scratch project's package.json depends on `@workerstack/backend`, and no node_modules there holds it.
Bun auto-installs a missing dependency on first import, so the child pulled the published tarball and ran
its old code. The test then checked behavior from the last release, not from the working tree, and passed
or failed for reasons unrelated to the change under test.

## Fix
Spawn every Bun child that should run workspace source with `--no-install --conditions=backend-source`,
and say why in a comment beside the spawn. To prove the child runs the source, make a change in the source
that the test must see, and watch it go red.
