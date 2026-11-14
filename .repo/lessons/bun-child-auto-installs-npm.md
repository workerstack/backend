---
name: bun-child-auto-installs-npm
paths: ["packages/core/src/build/init.test.ts", "packages/core/src/build/**"]
hits: 1
last-hit: 2026-11-14
evidence: ["plan 58"]
---

# A spawned Bun child loads the published package, not the source

## Mistake
A test spawned `bun -e` in a scratch project that depends on `@workerstack/backend` with no node_modules holding it. Bun auto-installed the npm build, so the test checked the last release, not the working tree.

## Fix
Spawn every Bun child that should run workspace source with `--no-install --conditions=backend-source`, with a comment saying why. Prove it: change the source in a way the test must see and watch it go red.
