---
name: generate-check-reads-the-index
paths: ["package.json", "packages/core/tests/e2e/apps/*/src/_gen/**"]
hits: 1
last-hit: 2026-11-14
evidence: ["plan 62"]
---

# `generate:check` fails an intended regeneration until it is staged

Plan 62 regenerated kitchen's `openapi.gen.json` on purpose, and the local `bun run generate:check`
then failed on that same diff.

## Mistake
`generate:check` is `bun run generate && git diff --exit-code -- packages/core/tests/e2e/apps`.
A bare `git diff` compares the work tree with the index, so a regenerated file that is meant to
change still counts as drift until it is staged. Reading that failure as a product bug, or
regenerating again, wastes a gate run.

## Fix
After `bun run generate`, read `git diff --stat -- packages/core/tests/e2e/apps` and confirm the
change is the intended one. Then stage those paths by name and run `generate:check`. It passes when
the staged output matches what `generate` writes, and CI checks the same thing on the committed tip.
