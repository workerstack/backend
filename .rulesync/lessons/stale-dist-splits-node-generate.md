---
name: stale-dist-splits-node-generate
paths: ["packages/core/src/build/loaders.ts", "packages/core/bin/backend.js", "packages/core/tests/e2e/run-build.ts"]
evidence: ["plan 65"]
---

# A built dist/ in the checkout fails test:build on Node

Plan 65's `test:build` failed for all six apps with `Cannot read properties of undefined (reading 'settings')` in
`hooksOf`, after an `npm pack --dry-run` had run `prepack` and left `packages/core/dist/` behind. HEAD failed the same
way with that `dist/`, and both passed once it was gone.

## Mistake
On Node, `backend generate` in a checkout loads core twice. Its `vite.config.ts` is loaded through jiti, which resolves
`@workerstack/backend/vite` to `dist/` when that exists, so the app is built by the dist core. `artifacts.ts` is then
loaded from source through the `node_modules` symlink, and its `[GRAPH]` symbol is not the app's. The error names core
internals, so it looks like a regression in the diff under test.

## Fix
Before calling a Node `test:build` failure a regression, check for `packages/core/dist/` and remove it (it is
gitignored), or rerun on a fresh tree. Anything that runs `prepack` (`npm pack`, a `--dry-run` included) writes it.
