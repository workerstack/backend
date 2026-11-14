/**
 * `honey init` (bit 19 h1, ported from v0's unit/plugin/cli-init.test.ts onto runInit; the CLI's exit codes are h2's):
 * the app, its Worker, wrangler.jsonc, Vite config and package.json written (apps run on Workers only, D16); an
 * existing app refused without --force and overwritten with it; an existing package.json's scripts and type kept and
 * reported; the scaffolded app serving /health, its document and its docs on v1's own source.
 */
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { parseInitFlags } from "./cli-args.ts"
import { runInit } from "./init.ts"

const SRC = new URL("../", import.meta.url).pathname
let dir = ""
let lines: string[] = []

/** `honey init` with `argv` in the temp project: its stdout lines. */
function init(argv: string[] = []): string[] {
	lines = []
	runInit(dir, parseInitFlags(argv), (line) => lines.push(line))
	return lines
}

/**
 * A Bun child loading the scaffolded `app` through jiti onto core's source, printing what /health, /openapi.json and
 * /docs answer: in a child, so the coverage run never instruments a second copy of core.
 */
const served = (app: string) => `
const { createJiti } = await import("jiti")
const alias = { "@workerstack/backend/http/openapi/scalar": ${JSON.stringify(join(SRC, "openapi/scalar.ts"))}, "@workerstack/backend/http/openapi": ${JSON.stringify(join(SRC, "openapi/register.ts"))}, "@workerstack/backend/http": ${JSON.stringify(join(SRC, "routing/app.ts"))} }
const { app } = await createJiti(${JSON.stringify(import.meta.url)}, { alias, moduleCache: false }).import(${JSON.stringify(app)})
const get = (path) => app.fetch(new Request("http://x" + path), {})
const [health, spec, docs] = await Promise.all([get("/health"), get("/openapi.json"), get("/docs")])
const document = await spec.json()
console.log(JSON.stringify([health.status, await health.text(), document.openapi, document.info.title, docs.status, (await docs.text()).includes("scalar")]))
`

const read = (rel: string) => readFileSync(join(dir, rel), "utf8")
const pkg = () => JSON.parse(read("package.json")) as Record<string, Record<string, string> | string | boolean>

beforeEach(() => {
	dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "honey-init-"))
})

afterEach(() => rmSync(dir, { force: true, recursive: true }))

describe("honey init", () => {
	// v0: 9789105764
	it("writes app, worker, wrangler.jsonc, vite config, and package scripts", () => {
		expect(init()).toEqual(["honey: initialized"])
		expect({
			app: read("src/app.ts").includes('get("/health")') && read("src/app.ts").includes("serveOpenApi("),
			pkg: pkg(),
			server: existsSync(join(dir, "src/server.ts")),
			vite: read("vite.config.ts").includes('from "@workerstack/backend/plugin"'),
			wrangler: read("wrangler.jsonc").includes('"main": "src/worker.ts"'),
		}).toEqual({
			app: true,
			pkg: {
				dependencies: { "@workerstack/backend": expect.stringMatching(/^\^\d+\.\d+\.\d+/) },
				devDependencies: { wrangler: "^4" },
				name: expect.stringMatching(/^honey-init-/),
				private: true,
				scripts: { dev: "wrangler dev", generate: "honey generate" },
				type: "module",
			},
			server: false,
			vite: true,
			wrangler: true,
		})
	})

	// v0: e534d87134
	it("refuses to overwrite an existing app without --force", () => {
		mkdirSync(join(dir, "src"))
		writeFileSync(join(dir, "src/app.ts"), "export const app = null\n")
		expect(() => init()).toThrow("src/app.ts already exists: rerun with --force to overwrite it")
		expect([read("src/app.ts"), existsSync(join(dir, "package.json"))]).toEqual(["export const app = null\n", false])
	})

	// v0: d9916786ef
	it("overwrites an existing app with --force", () => {
		mkdirSync(join(dir, "src"))
		writeFileSync(join(dir, "src/app.ts"), "export const app = null\n")
		init(["--force"])
		expect([
			read("src/app.ts").includes("null"),
			read("src/app.ts").includes('from "@workerstack/backend/http"'),
		]).toEqual([false, true])
	})

	// v0: 2bf1aba4cd
	it("writes a worker that exports fetch, and --workers is gone", () => {
		init()
		const worker = read("src/worker.ts")
		expect(["workersWebSocket", "export default", "app.fetch"].every((part) => worker.includes(part))).toBe(true)
		expect(() => parseInitFlags(["--workers"])).toThrow("unknown option --workers")
	})
})

/* a spawned bun process, as cli.test's legs: 0.3-0.6 s here even with coverage under load, yet it once passed vitest's
   5 s default in a full parallel run (bit 20 d) that no rerun reproduced; a process start gets the spawning legs' bound */
const SPAWN = 60_000

describe("the scaffolded app", () => {
	// v0: b3cda555b0
	it(
		"scaffolded app can serve /health and /openapi.json",
		async () => {
			init()
			const { stdout } = await promisify(execFile)(
				"bun",
				["--conditions=honey-source", "-e", served(join(dir, "src/app.ts"))],
				{
					cwd: SRC,
				},
			)
			expect(JSON.parse(stdout)).toEqual([200, "ok", "3.1.0", "Honey", 200, true])
		},
		SPAWN,
	)
})

describe("honey init and an existing package.json", () => {
	// v0: 6fcf217154
	it("keeps an existing package.json's scripts, type and privacy without --force", () => {
		const original = {
			dependencies: { zod: "^4.0.0" },
			name: "existing",
			scripts: { dev: "node server.js", generate: "make gen", test: "vitest" },
		}
		writeFileSync(join(dir, "package.json"), JSON.stringify(original))
		const out = init()
		expect(pkg()).toEqual({
			dependencies: { "@workerstack/backend": expect.any(String), zod: "^4.0.0" },
			devDependencies: { wrangler: "^4" },
			name: "existing",
			scripts: original.scripts,
		})
		expect(out).toEqual([
			'honey: kept scripts.dev ("node server.js"); honey expects "wrangler dev"',
			'honey: kept scripts.generate ("make gen"); honey expects "honey generate"',
			'honey: package.json has no "type"; the scaffold is ESM: set "type": "module", or rerun with --force',
			"honey: initialized",
		])
	})

	// v0: 594d6c8fc8
	it("--force updates the honey scripts and type of an existing package.json", () => {
		const scripts = { dev: "node server.js", test: "vitest" }
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "existing", scripts, type: "commonjs" }))
		init(["--force"])
		/* an explicit type is the project's choice */
		expect([pkg().scripts, pkg().type]).toEqual([
			{ dev: "wrangler dev", generate: "honey generate", test: "vitest" },
			"commonjs",
		])
	})

	// v0: f384f4046d
	it("unknown flags fail", () => {
		expect(() => parseInitFlags(["--forse"])).toThrow("unknown option --forse")
	})
})

describe("honey init over a package.json it cannot use as is (bit 19 h1)", () => {
	it("keeps an existing honey dependency without --force, and names a symbol-only directory honey-app", () => {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { "@workerstack/backend": "^0.9.0" } }))
		init()
		const unnamed = join(dir, "-!-")
		mkdirSync(unnamed)
		runInit(unnamed, parseInitFlags([]), () => {})
		const name = (JSON.parse(readFileSync(join(unnamed, "package.json"), "utf8")) as { name: string }).name
		expect([pkg().dependencies, name]).toEqual([{ "@workerstack/backend": "^0.9.0" }, "honey-app"])
	})

	it("keeps an existing wrangler devDependency without --force, and sets its own with it", () => {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ devDependencies: { wrangler: "3.0.0" }, type: "module" }))
		init()
		const kept = pkg().devDependencies
		init(["--force"])
		expect([kept, pkg().devDependencies]).toEqual([{ wrangler: "3.0.0" }, { wrangler: "^4" }])
	})

	it("refuses a package.json that is no JSON, or no object, naming it", () => {
		const refused = (text: string) => {
			writeFileSync(join(dir, "package.json"), text)
			try {
				init(["--force"])
				return "accepted"
			} catch (error) {
				return (error as Error).message
			}
		}
		expect([refused("{"), refused("[]")]).toEqual(["package.json is not valid JSON", "package.json must be an object"])
	})
})
