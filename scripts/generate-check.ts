#!/usr/bin/env bun
// `bun scripts/generate-check.ts`: regenerate every e2e app's `_gen/` output and fail when that changes a tracked file,
// so a route edit that left the generated clients behind is caught before CI's generation step finds it.
import { spawnSync } from "node:child_process";

const APPS = "packages/core/tests/e2e/apps";

/** Run `cmd` with inherited output; its exit status, 1 when it could not start. */
function run(cmd: string, args: readonly string[]): number {
  return spawnSync(cmd, args, { stdio: "inherit" }).status ?? 1;
}

const generated = run(process.execPath, ["run", "generate"]);

process.exit(generated === 0 ? run("git", ["diff", "--exit-code", "--", APPS]) : generated);
