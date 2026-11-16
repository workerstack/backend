/**
 * The build tooling's loaders (bit 19 h2): a TypeScript Vite config found and read on plain Node through Vite's module
 * runner (v0 H70b), each module evaluated once per loader, through Bun's own import on Bun, the `backendPlugin()` configs read off the
 * plugin objects, and Effect's converter when effect is installed.
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createModuleLoader,
  effectConverter,
  findViteConfig,
  loadPluginConfigs,
  type ModuleLoader,
} from "./loaders.ts";

const LOADERS = new URL("./loaders.ts", import.meta.url).pathname;
const ENV = { command: "build", mode: "production" } as const;
const dirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();

  for (const dir of dirs.splice(0)) rmSync(dir, { force: true, recursive: true });
});

/** A temp directory holding `files`. */
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "core-loaders-"));
  dirs.push(dir);

  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), text);
  }

  return dir;
}

/** A `backendPlugin()` plugin object as the plugin presents one, carrying `config`. */
const backendPlugin = (config: string) => `{ name: "backend", api: { backendConfig: ${config} } }`;

describe("a Vite config read on plain Node (bit 19 h2)", () => {
  // v0: bd0ee20213
  it("H70b: `backend generate` on plain Node finds the Vite config", async () => {
    const dir = project({
      // an enum: syntax Node's type stripping refuses, so only Vite's runner can load this config
      "plugin.ts": `enum Kind { Tree = "tree" }\nexport const backend = (app: string) => (${backendPlugin("{ app, codegen: Kind.Tree }")})\n`,
      "vite.config.ts": 'import { backend } from "./plugin"\nexport default { plugins: [backend("src/app.ts")] }\n',
    });

    const script = [
      `import { createModuleLoader, findViteConfig, loadPluginConfigs } from ${JSON.stringify(LOADERS)}`,
      `const config = findViteConfig(${JSON.stringify(dir)})`,
      `const load = await createModuleLoader({ fresh: false, from: config })`,
      `console.log(JSON.stringify(await loadPluginConfigs(config, load, { command: "build", mode: "production" })))`,
    ].join("\n");

    // plain Node, as a user starts it: never Bun, which loads TypeScript on its own
    const read = await promisify(execFile)("node", ["--input-type=module", "-e", script], { cwd: dir }).then(
      ({ stdout }) => JSON.parse(stdout) as unknown,
      (error: { stderr?: string }) => error.stderr,
    );

    expect(read).toEqual([{ app: "src/app.ts", codegen: "tree" }]);
  }, 60_000);

  it("finds the config by Vite's own order, and none in a directory without one", () => {
    const both = project({ "vite.config.js": "", "vite.config.mts": "" });
    expect([findViteConfig(both), findViteConfig(project({}))]).toEqual([join(both, "vite.config.mts"), undefined]);
  });
});

describe("each backendPlugin() config in a Vite config, in plugin order (bit 19 h2)", () => {
  const configsOf = async (config: string) => {
    const dir = project({ "vite.config.ts": config });

    return loadPluginConfigs(join(dir, "vite.config.ts"), await createModuleLoader({ fresh: true, from: dir }), ENV);
  };

  it("reads nested and promised plugin arrays, a function-form config called with the env", async () => {
    const config = [
      `const a = ${backendPlugin('{ app: "a" }')}`,
      `const b = ${backendPlugin('{ app: "b" }')}`,
      "export default (env) => ({",
      `  plugins: [{ name: "other" }, null, [a, Promise.resolve([${backendPlugin("{ app: env.mode, ssr: env.isSsrBuild }")}])], Promise.resolve(b)],`,
      "})",
    ].join("\n");

    expect(await configsOf(config)).toEqual([{ app: "a" }, { app: "production", ssr: false }, { app: "b" }]);
  });

  it("reads a module-form config, and passes over a backend-named plugin without a config", async () => {
    const config = `export const plugins = [{ name: "backend" }, { name: "backend", api: {} }, ${backendPlugin("{ app: 1 }")}]`;
    expect([await configsOf(config), await configsOf("export default {}")]).toEqual([[{ app: 1 }], []]);
  });
});

describe("a module loader for one generation (bit 19 h2)", () => {
  // each evaluation counts on globalThis, so a re-evaluated module shows
  const counted = (load: ModuleLoader, path: string) => load(path).then((mod) => mod.n);

  it("evaluates each path once per loader; a fresh loader evaluates an edited module anew", async () => {
    const dir = project({ "count.ts": "globalThis.__loads = (globalThis.__loads ?? 0) + 1\nexport const n = 1\n" });
    const path = join(dir, "count.ts");
    const load = await createModuleLoader({ fresh: true, from: dir });
    const first = [await counted(load, path), await counted(load, path)];
    writeFileSync(path, "globalThis.__loads = (globalThis.__loads ?? 0) + 1\nexport const n = 2\n");
    const fresh = await counted(await createModuleLoader({ fresh: true, from: dir }), path);
    expect([first, fresh, (globalThis as { __loads?: number }).__loads]).toEqual([[1, 1], 2, 2]);
  });

  it("shares a module two of its paths import, so an app and the core reading it are one instance", async () => {
    const dir = project({
      "a.ts": 'import { n } from "./shared.ts"\nexport const a = n\n',
      "b.ts": 'import { n } from "./shared.ts"\nexport const b = n\n',
      "shared.ts": "globalThis.__shared = (globalThis.__shared ?? 0) + 1\nexport const n = {}\n",
    });

    const load = await createModuleLoader({ fresh: true, from: dir });
    const [{ a }, { b }] = [await load(join(dir, "a.ts")), await load(join(dir, "b.ts"))];
    expect([a === b, (globalThis as { __shared?: number }).__shared]).toEqual([true, 1]);
  });

  it("on Bun, imports each path once per loader; a fresh loader evicts what the registry holds outside node_modules", async () => {
    const dir = project({ "native.ts": "globalThis.__native = (globalThis.__native ?? 0) + 1\nexport const n = 3\n" });
    const path = join(dir, "native.ts");
    // the registry as the loader sees it: an installed module, and a module of the project's
    const registry = () => ({ "/p/node_modules/dep/index.js": 1, "/p/src/app.ts": 1 });
    const [kept, evicted] = [registry(), registry()];
    const load = await createModuleLoader({ fresh: false, from: dir }, kept, true);
    const first = [await counted(load, path), await counted(load, path)];
    await createModuleLoader({ fresh: true, from: dir }, evicted, true);
    expect([first, (globalThis as { __native?: number }).__native, Object.keys(kept), Object.keys(evicted)]).toEqual([
      [3, 3],
      1,
      ["/p/node_modules/dep/index.js", "/p/src/app.ts"],
      ["/p/node_modules/dep/index.js"],
    ]);
  });
});

/** An installed package `name` whose one module `main` exports `n`. */
const installed = (name: string, main: string) => ({
  [`node_modules/${name}/${main}`]: "export const n = {}\n",
  [`node_modules/${name}/package.json`]: JSON.stringify({ exports: `./${main}`, name, type: "module" }),
});

/** What `dir`'s app.ts exports as `from`, loaded with this process's flags as given: the loader reads them. */
async function fromAppStartedWith(dir: string, execArgv: string[], nodeOptions: string) {
  const own = process.execArgv;
  process.execArgv = execArgv;
  vi.stubEnv("NODE_OPTIONS", nodeOptions);

  try {
    return (await (await createModuleLoader({ fresh: true, from: dir }, {}, false))(join(dir, "app.ts"))).from;
  } finally {
    process.execArgv = own;
  }
}

describe("a module loader on Node, through Vite's module runner", () => {
  it("says to install vite when vite itself is missing, and passes any other failure through", async () => {
    const dir = project({});

    const missing = (name: string) =>
      Object.assign(new Error(`Cannot find package '${name}' imported from ${dir}`), { code: "ERR_MODULE_NOT_FOUND" });

    const other = missing("rolldown");

    const loaderWith = (failure: Error) =>
      createModuleLoader({ fresh: true, from: dir }, {}, false, () => Promise.reject(failure)).then(
        () => "loaded",
        (error: Error) => error,
      );

    const [vite, rolldown] = [await loaderWith(missing("vite")), await loaderWith(other)];
    expect([(vite as Error).message, rolldown]).toEqual([
      "backend generate on Node loads TypeScript through Vite: install vite, or run it with Bun",
      other,
    ]);
  });

  it("shares an installed package between an app importing it and a path loaded inside it, JS or TypeScript", async () => {
    const dir = project({
      "app.ts": 'export { n as js } from "built"\nexport { n as ts } from "source"\n',
      ...installed("built", "index.js"),
      ...installed("source", "index.ts"),
    });

    // as a generation loads the app, then core's artifacts module from the app's own install
    const load = await createModuleLoader({ fresh: true, from: dir }, {}, false);
    const app = await load(join(dir, "app.ts"));

    const [built, source] = [
      await load(join(dir, "node_modules/built/index.js")),
      await load(join(dir, "node_modules/source/index.ts")),
    ];

    expect([app.js === built.n, app.ts === source.n]).toEqual([true, true]);
  });

  it("resolves a linked package by the conditions the runtime was started with", async () => {
    const dir = project({
      "app.ts": 'export { from } from "linked"\n',
      "linked/dist.js": 'export const from = "dist"\n',
      "linked/package.json": JSON.stringify({
        exports: { ".": { "backend-source": "./source.ts", default: "./dist.js" } },
        name: "linked",
        type: "module",
      }),
      "linked/source.ts": 'export const from: string = "source"\n',
    });

    mkdirSync(join(dir, "node_modules"));
    // a workspace link: the package's real path is outside node_modules, so the runner resolves it itself
    symlinkSync(join(dir, "linked"), join(dir, "node_modules/linked"), "dir");
    // flags set here, not inherited: vitest starts its workers with --conditions backend-source
    expect([
      await fromAppStartedWith(dir, [], ""),
      await fromAppStartedWith(dir, ["-C", "backend-source"], ""),
      await fromAppStartedWith(dir, [], "--max-old-space-size=4096 --conditions=backend-source"),
    ]).toEqual(["dist", "source", "source"]);
  });
});

describe("a module loader on Bun's global (bit 20 k-fix)", () => {
  it("imports a module as Bun's own import does", async () => {
    const dir = project({ "plain.ts": "export const v = 9\n" });
    vi.stubGlobal("Bun", {});
    // not fresh: a fresh loader would evict from the registry this test runner's process holds
    const load = await createModuleLoader({ fresh: false, from: dir });
    expect((await load(join(dir, "plain.ts"))).v).toBe(9);
  });

  it("refuses a reload that finds no project module to evict, rather than read a stale graph", async () => {
    const dir = project({});
    // a registry keyed otherwise than the loader reads, as a runtime upgrade could leave it: nothing it would evict
    const installedOnly = { "/p/node_modules/dep/index.js": 1 };
    const withApp = { "/p/node_modules/dep/index.js": 1, "/p/src/app.ts": 1 };

    const reload = (registry: Record<string, unknown>) =>
      createModuleLoader({ fresh: true, from: dir, reload: true }, registry, true).then(
        () => "loaded",
        (error: Error) => error.message,
      );

    expect([await reload(installedOnly), await reload(withApp), Object.keys(withApp)]).toEqual([
      "the module registry held none of the project's modules to evict: a reload would read them stale",
      "loaded",
      ["/p/node_modules/dep/index.js"],
    ]);
  });
});

describe("Effect's JSON Schema converter (bit 19 h2)", () => {
  it("is effect's JSONSchema.make when effect is installed, else undefined", async () => {
    const make = await effectConverter();
    expect([
      (make?.(Schema.String as never) as { type?: string } | undefined)?.type,
      await effectConverter("node:path"),
      await effectConverter("no-such-module-backend"),
    ]).toEqual(["string", undefined, undefined]);
  });
});
