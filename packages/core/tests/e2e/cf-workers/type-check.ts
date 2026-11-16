/**
 * cf-workers' type check: one program per e2e app under `@cloudflare/workers-types`. Each program holds the harness
 * (`src/worker.ts` with the `src/load.ts` it imports, and for mcp `src/mcp-dev.ts`), that app's source with its
 * generated `src/_gen/types.gen.d.ts`, and every other app as the `types/e2e-app.d.ts` stub. A program holds one app's
 * `HttpCodegen` slot, as a deployed worker does: two would collide (TS2717), and none leaves the app's `OperationCtx`
 * untyped. Prints `cf type-check <app>: ok` or that app's errors, and exits non-zero when any app fails.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const here = import.meta.dirname;
const appsDir = resolve(here, "../apps");

// the repo's gitignored scratch: the configs are written per run, never committed
const outDir = resolve(here, "../../../../../.tmp/cf-type-check");
const stub = join(here, "types/e2e-app.d.ts");

// typescript's exports leave out its bin, so it is found beside the package's manifest
const tsc = join(dirname(createRequire(import.meta.url).resolve("typescript/package.json")), "bin/tsc");

type App = { dir: string; name: string; pkg: string };

const apps: App[] = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(appsDir, entry.name, "package.json")))
  .map((entry) => {
    const dir = join(appsDir, entry.name);
    const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string };

    return { dir, name: entry.name, pkg: name };
  })
  .sort((a, b) => (a.name < b.name ? -1 : 1));

/** The tsconfig of `app`'s program: the harness, the app's slot, and every other app as the stub. */
function configOf(app: App): string {
  const slot = join(app.dir, "src/_gen/types.gen.d.ts");

  const files = [
    join(here, "src/worker.ts"),
    // mcp-dev passes mcp's own options, so it is checked where mcp is real
    ...(app.name === "mcp" ? [join(here, "src/mcp-dev.ts")] : []),
    ...(existsSync(slot) ? [slot] : []),
  ];

  const paths = Object.fromEntries(apps.filter((other) => other !== app).map((other) => [other.pkg, [stub]]));
  // `include`, not `files`: a config's own `files` would replace the base's reset.d.ts and worker.d.ts, which it
  // inherits; `exclude` is emptied so tsconfig.json's leaving worker.ts and load.ts out does not drop them here
  const config = { compilerOptions: { paths }, exclude: [], extends: join(here, "tsconfig.json"), include: files };
  const path = join(outDir, `${app.name}.json`);
  writeFileSync(path, `${JSON.stringify(config, null, "\t")}\n`);

  return path;
}

/** `tsc --noEmit -p config`: its exit code and its output. */
function check(config: string): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [tsc, "--noEmit", "-p", config], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk));
    child.on("close", (code) => done({ code: code ?? 1, output }));
  });
}

mkdirSync(outDir, { recursive: true });

const results = await Promise.all(apps.map(async (app) => ({ app, ...(await check(configOf(app))) })));

for (const { app, code, output } of results) {
  process.stdout.write(
    code === 0 ? `cf type-check ${app.name}: ok\n` : `cf type-check ${app.name}: failed\n${output.trimEnd()}\n`,
  );
}

process.exit(results.every((result) => result.code === 0) ? 0 : 1);
