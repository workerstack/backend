---
name: ci-env-differs-from-local
paths: ["packages/core/src/**",".github/workflows/ci.yml","packages/core/tests/build/runtime-bundle.test.ts"]
hits: 4
last-hit: 2026-11-14
evidence: ["plan 21","plan 48: runtime-bundle locks set from local Node 26.12.0's zlib; CI's node-current 26.13.0 (zlib 1.3.2.1-motley) gzips the same bundle 64-71 bytes larger and failed the static-doc lock","plan 53: node 22.12.0 packaging leg, dist import bypassed jiti","plan 58: mcp-oauth skipped locally without the pinned MCP clients; CI installs them and the fixture's id-less routes failed"]
---

# `verify` runs CI's scripts, not CI's environment

## Mistake
Product code read `BACKEND_REQUIRE_TOOLCHAINS`, a harness switch CI sets, so CI threw where local passed. Size locks gzip with CI's newer Node, and stderr asserts saw CI's installed tools. Green locally, red in CI.

## Fix
Product code never reads `BACKEND_REQUIRE_*` (env-ownership test). Before pushing toolchain work run `BACKEND_REQUIRE_TOOLCHAINS=1` gates; pin PATH or `$RUFF`/`$RUSTFMT`/`$GOFMT` in exact-output legs; measure size locks under node-current.
