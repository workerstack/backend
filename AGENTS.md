<!-- repo:rules deade236 -->
Write in en-US, in extremely plain words: short sentences, common words, one idea each. Say only what the person needs to act. One sentence is fine when that is the whole answer. When something is broken, give the problem and the next step in one or two sentences.

Work as a partner who needs this to ship. Use "we" for the goal, "you" for their steps, "I" for yours.

Start with where we stand: what is done, what is stuck or not checked, with paths, counts, and pass or fail. Bad news first. A mixed result stays mixed. If they must act, give exact steps grouped by where they do them, then what you will do next. End with the one next action or decision.

Never use jargon or internal names they did not use, arrows, `key=value` tokens, sentence fragments, background they did not ask for, praise, reassurance, or hedging.

These rules are for replies to the person. Plans, commits, PRs, docs, code comments, prompts to other agents, and skill output keep their own format.

An example, or a list ending in `...` or `etc`, stands for a kind of thing. Do everything of that kind that fits, not only the named items, and nothing outside it. Closed instructions stay literal.

Ship only the optimal solution. If what exists is not optimal, rewrite it. Leave no monkey-patches, workarounds, shims or TODOs in code. Flag blockers. When advising, be thorough in the analysis and bold in the recommendation: pick the best option from research, data and reasoning, not from what the user seems to want. Change it only for new evidence or a flaw you found; pushback alone is not a reason. Do and check the work yourself with every tool you have. Do not guess, and do not hand the user work you could do. Ask only when you truly cannot find out, and say what you tried. Under `/away`, never ask: decide, log each choice as a `- decision:` entry, and let the hook run a reviewed approval block. Stopping for approval of a written plan is not stopping short. Add no AI attribution, Co-Authored-By, or generated markers.

Before you change anything, read `node_modules/@workerstack/repo/references/scope.md`. It says how much process a change needs: whether to plan, how deep to research, and when to wait for approval. Whatever the process, ask the user only what they alone can answer.

Changes happen in the main checkout, on the default branch. Edit, test and commit there, then run `bun repo push`. Run no destructive git (stash, reset, checkout, switch, restore, clean, rebase, force push, deleting the default branch) unless the user asked. Never drop stashes you did not make.

Read `node_modules/@workerstack/repo/references/INDEX.md` once. When a line matches the work, read that file in full. No folder map in your context? Run `bun repo map [dir]`, not `ls` or `find`.

Found work outside the task? Run `bun repo backlog add "<text>"`, don't do it now, and name it in your reply.

When a change needs a plan and no skill was named, use the plan skills of the effort the hook context names: /write-plan-{effort} and /implement-plan-{effort}, or /write-roadmap-{effort} and /implement-roadmap-{effort} for two or more slices.
<!-- /repo:rules -->

## Writing style

en-US English everywhere — code, comments, docs, commit messages.

## Tests are the truth

Every change starts with a test: a bug, a reported issue, a review finding, a feature, a refactor. Red: write the
test and run it to show it fails, for the reason the test names. Fix: the smallest change that makes it pass. Green:
run it again, then the tests the change reaches. A fix without a test that failed first is not done. A test that
cannot fail proves nothing: break the fix, and the test must go red.

Locally, a commit runs the tests its change reaches. CI on the pushed tip is the full gate: `bun repo check`, `fmt:check`,
`typecheck`, `test`, `generate:check`, `typecheck:consumers`, `test:consumers` and `test:e2e`. After a push,
`bun repo ci wait` waits for the run and names any failed job and its log. While CI is red, the only work is
fixing it. Never use `--no-verify`. A failure is never skipped, retried away, or called flaky.

## Git

Stay on `main`. Don't create, switch, or delete branches.

Fine without asking: `status`, `diff`, `log`, `add`, `commit`, `push`.

Ask first, and wait: anything that can lose work — `reset --hard`, `checkout` /
`restore` over uncommitted changes, `clean`, `stash` (any form), `push --force`
(including `--force-with-lease`), `rebase`, `cherry-pick`, `revert`,
`commit --amend`, deleting tags, anything reflog-driven. If you can't tell,
assume it can.

## Before you call it done

From the repo root; CI runs the same set, with `fmt:check` in place of `fmt`.
`generate` first — the e2e apps'
generated clients feed typecheck and tests.

    bun run generate
    bun run fmt          # repo fmt (oxfmt), rewrites in place
    bun repo check       # configs, manifests, comments, the lint ratchet, knip
    bun run typecheck
    bun run typecheck:consumers
    bun run test
    bun run test:consumers

Touching `src/build`, `codegen-loaders.ts`, or anything a bundler sees? Also run
`bun run test:build` — the only thing that catches an optional dependency
leaking into a worker bundle.

Touching `package.json` exports, `files`, or anything about what ships? Also run
`bun run test:packaging` — it packs the real tarball and type-checks a consumer
with every strictness flag on. See `packages/core/docs/packaging.md`.

Per-runtime e2e (`test:e2e:cf`) needs extra toolchains — leave to CI.
