---
name: run-the-gates-that-read-your-source
paths: ["packages/core/src/**","packages/core/lint/**","blueprint/files.tsv"]
hits: 8
last-hit: 2026-11-14
evidence: ["plan 33","plan 40 rc.22: init.test.ts spawned bun -e on core source without --conditions=honey-source, so the new #output-check package import resolved to an unbuilt dist; lane gates passed, the first tip verify caught it","plan 48: lint max-lines on route-builder.ts and a 113-line describe, and a docs block examples-compile reads, failed after the touched suites were green","plan 59: the full CI-env test run's 100% branch floor caught resolveInvalidate's untested non-string branch after the touched suites were green","plan 60: the full lint found the bare Tap export and three typetests without assertions, and the CI-env test found the runtime bundle 454 bytes over its lock; neither showed in the touched suites"]
---

# Changed source reds the gates that read it, not only its own tests

## Mistake
I ran only the suites of touched files and called it done. Lint derivations, structure tests, coverage floors, `blueprint/files.tsv`, max-lines and bundle locks read the same source and failed later, over many verify passes.

## Fix
After changing `packages/*/src`, run `bun vitest run --root packages/core lint tests/structure` and `bun run lint`, then the AGENTS.md gates. A new file needs its `blueprint/files.tsv` row. Split files past `max-lines` (300) or `max-lines-per-function` (60) by meaning.
