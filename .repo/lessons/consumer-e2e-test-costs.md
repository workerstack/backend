---
name: consumer-e2e-test-costs
paths: ["blueprint/baselines/e2e-expected.json","packages/core/tests/e2e/run.ts","packages/core/tests/e2e/apps/*/tests/e2e/*.test.ts"]
hits: 2
last-hit: 2026-11-15
evidence: ["plan 19","plan 6 (roadmap 1): a surface leg sent before the socket opened, and its zod issue text differs in the prod Workers build"]
---

# A new consumer e2e test reds test:e2e twice

## Mistake
A new app e2e test asserted backend's `internal_server_error` where kitchen's `.defaultBoundary("api_error")` answers `api_error`. It also moved six cells of `e2e-expected.json`; only the bun cell runs locally, so CI still red.

## Fix
Read the app's error factory and `.defaultBoundary(...)` first. Re-record the bun cell with `run.ts --env bun --app <app> --record blueprint/baselines/e2e-expected.json`, write the others by rule per env and mode, and keep `→` unescaped.
Await a WebSocket's open before its first send. Run `--mode prod` too before the commit: a Workers build drops zod's English detail, so a leg asserts a validator's message only as far as "Invalid input".
