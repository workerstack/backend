---
name: ci-env-differs-from-local
paths: ["packages/core/src/**",".github/workflows/ci.yml","packages/core/tests/build/runtime-bundle.test.ts"]
hits: 3
last-hit: 2026-11-14
evidence: ["plan 21","plan 48: runtime-bundle locks set from local Node 26.12.0's zlib; CI's node-current 26.13.0 (zlib 1.3.2.1-motley) gzips the same bundle 64-71 bytes larger and failed the static-doc lock","plan 53: node 22.12.0 packaging leg, dist import bypassed jiti"]
---

# `verify` runs CI's scripts, not CI's environment

1.0.0-rc.10's release run died on five tests after a green local `bun run verify`. CI runs the same

## Mistake
`missingFormatter` read `BACKEND_REQUIRE_TOOLCHAINS` to decide whether a missing formatter throws.
`.github/workflows/ci.yml` sets that on six jobs, where it means "this leg's toolchain must be present,
do not skip" — a harness switch, not a product one. So in CI every incidental generation without oxfmt
threw. Locally nothing sets it, so verify took the other branch and passed.

The second half of the same gap: oxfmt is a devDependency here and an optional peer in a packed
tarball, so a report line that never appeared locally appeared in CI's install legs, where the test
asserts stderr exactly.

## Fix
Product code gets its own variable, never one the harness owns, and
`packages/gen/tests/structure/env-ownership.test.ts` now fails if any source under `packages/*/src`
reads `BACKEND_REQUIRE_*`. It tells a read from a mention, so a comment naming the variable it avoids is
still legal.

For anything touching generation or a toolchain, run the gate under CI's own environment before
pushing:

    BACKEND_REQUIRE_TOOLCHAINS=1 bun run verify

And when a leg asserts exact stderr or stdout, pin what it depends on — `{ PATH: "" }`, or the pinned
binary through `$RUFF`/`$RUSTFMT`/`$GOFMT` — rather than inheriting the machine. A leg whose
expectation changes with what happens to be installed passes here and fails there.

A size lock is the same gap. `tests/build/runtime-bundle.test.ts` gzips with the Node that runs vitest,
and CI's test job runs node-current (`bun packages/core/tests/build/node-current.ts`), not the machine's
Node. Plan 48 set its locks from Node 26.12.0; CI's 26.13.0 (zlib 1.3.2.1-motley) gzips the same bytes
up to 71 larger and failed the lock. Measure a new lock under that Node before pushing.
