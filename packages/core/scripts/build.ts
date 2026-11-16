#!/usr/bin/env bun
/**
 * Builds `dist/`: JavaScript and declarations for every module under `src/` (the `build` script, tsc -p
 * tsconfig.build.json) into an emptied dist/. `prepack` runs
 * this, so a tarball cannot ship without it; an install runs dist/, a checkout the source (the `backend-source`
 * condition, bin/backend.js).
 *
 *   bun scripts/build.ts
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

rmSync(join(root, "dist"), { force: true, recursive: true });

const built = spawnSync(process.execPath, ["run", "build"], { cwd: root, stdio: "inherit" });

if (built.status !== 0) {
  console.error("build: tsc failed");
  process.exit(built.status ?? 1);
}

console.log("build: dist ready");
