---
name: stale-dist-splits-node-generate
paths: ["packages/core/src/build/loaders.ts", "packages/core/bin/backend.js", "packages/core/tests/e2e/run-build.ts"]
hits: 1
last-hit: 2026-11-15
evidence: ["plan 65"]
---

# A built dist/ in the checkout fails test:build on Node

## Mistake
A leftover `packages/core/dist/` made Node load core twice: jiti took dist for the vite config, source came via the symlink. All six apps failed with `reading 'settings'` in `hooksOf`, which looked like a regression in the diff.

## Fix
Before calling a Node `test:build` failure a regression, check for `packages/core/dist/` and remove it (it is gitignored), or rerun on a fresh tree. Anything that runs `prepack` writes it, `npm pack --dry-run` included.
