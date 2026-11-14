---
name: consumer-e2e-test-costs
paths: ["blueprint/baselines/e2e-expected.json","packages/core/tests/e2e/run.ts","packages/core/tests/e2e/apps/*/tests/e2e/*.test.ts"]
hits: 1
last-hit: 2026-11-01
evidence: ["plan 19"]
---

# A new consumer e2e test reds test:e2e twice

## Mistake
A new app e2e test asserted backend's `internal_server_error` where kitchen's `.defaultBoundary("api_error")` answers `api_error`. It also moved six cells of `e2e-expected.json`; only the bun cell runs locally, so CI still red.

## Fix
Read the app's error factory and `.defaultBoundary(...)` first. Re-record the bun cell with `run.ts --env bun --app <app> --record blueprint/baselines/e2e-expected.json`, write the others by rule per env and mode, and keep `→` unescaped.
