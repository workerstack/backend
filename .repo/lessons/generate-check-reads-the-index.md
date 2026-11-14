---
name: generate-check-reads-the-index
paths: ["package.json", "packages/core/tests/e2e/apps/*/src/_gen/**"]
hits: 1
last-hit: 2026-11-14
evidence: ["plan 62"]
---

# `generate:check` fails an intended regeneration until it is staged

## Mistake
`generate:check` is `generate && git diff --exit-code` on the e2e apps. A bare `git diff` compares the work tree with the index, so an intended regeneration counts as drift until staged; reading it as a bug wastes a run.

## Fix
After `bun run generate`, read `git diff --stat -- packages/core/tests/e2e/apps` and confirm the change is intended. Stage those paths by name, then run `generate:check`; CI checks the same on the committed tip.
