/**
 * What ships (bit 19 i): the real tarball of `@workerstack/backend`, packed by npm and installed into a consumer outside
 * the repo beside `@workerstack/clients` at the version core pins. The install carries every export's files,
 * type-checks against every core subpath under maximal strictness, runs the bin from dist/, and generates an app's artifacts through the
 * tarball's own `build/artifacts` (generate.ts `artifactsFor`). A bin picks dist/ in an install and the source in a
 * checkout; `ws`, core's optional peer, fails with an install hint until it is installed, then works in that process.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CLIENTS, CORE, consumer, pack, REPO, run, scratch, write } from "./fixture/packed.ts"
import { SPAWN_TIMEOUT } from "../fixture/spawn-timeout.ts"

const TSC = join(REPO, "node_modules/typescript/bin/tsc")
const files = scratch("packaging")
let tarball = ""
let app = ""

const APP = [
	'import { createMiddleware, defineErrors, honey } from "@workerstack/backend"',
	'import { cors } from "@workerstack/backend/cors"',
	'import { serveOpenApi } from "@workerstack/backend/openapi"',
	'import { requestId } from "@workerstack/backend/request-id"',
	'import * as z from "zod"',
	"",
	'const errors = defineErrors({ item_not_found: "not_found" })',
	"",
	"export const app = serveOpenApi(",
	"\thoney<{}>()",
	"\t\t.errorFactory(errors)",
	"\t\t.use(requestId())",
	'\t\t.use(cors({ origin: "http://app.test" }))',
	'\t\t.use(createMiddleware((_ctx, next) => next({ userId: "u-1" })))',
	'\t\t.get("/health")',
	'\t\t.handler((ctx) => ctx.res.text("ok", "ok"))',
	'\t\t.post("/items")',
	"\t\t.input({ json: z.object({ name: z.string() }) })",
	'\t\t.output({ "application/json": { created: z.object({ name: z.string(), userId: z.string() }) } })',
	'\t\t.handler((ctx) => ctx.res.json("created", { name: ctx.input.json.name, userId: ctx.userId })),',
	'\t{ title: "Consumer", version: "1.0.0" },',
	")",
	"",
].join("\n")

/* the generated selectors narrow `RouteSelectorOf` through the root entry's re-export, or the expect-error is unused */
const SELECTORS = [
	'import type { RouteSelectorOf } from "@workerstack/backend"',
	"",
	'export const health: RouteSelectorOf = "GET /health"',
	"// @ts-expect-error a route the app does not have",
	'export const missing: RouteSelectorOf = "GET /missing"',
	"",
].join("\n")

const STRICT = {
	allowUnreachableCode: false,
	allowUnusedLabels: false,
	exactOptionalPropertyTypes: true,
	isolatedModules: true,
	noEmit: true,
	noFallthroughCasesInSwitch: true,
	noImplicitOverride: true,
	noImplicitReturns: true,
	noPropertyAccessFromIndexSignature: true,
	noUncheckedIndexedAccess: true,
	noUncheckedSideEffectImports: true,
	noUnusedLocals: true,
	noUnusedParameters: true,
	/* the package's own declarations are checked under these flags too */
	skipLibCheck: false,
	strict: true,
	target: "ESNext",
	types: ["node"],
	verbatimModuleSyntax: true,
}

type Exports = Record<string, Record<string, string> | string>
const manifest = (pkg: string, dir = app): { exports: Exports } =>
	JSON.parse(readFileSync(join(dir, "node_modules", pkg, "package.json"), "utf8")) as { exports: Exports }

/* every core subpath re-exported from `dir`'s src, type-checked under STRICT: the subpath count, tsc's code and output */
function strictCheck(dir: string, resolution: string, module: string): [number, number, string] {
	const subpaths = Object.keys(manifest("@workerstack/backend", dir).exports).filter((s) => s !== "./package.json")
	const lines = subpaths.map((s, i) => `export * as s${i} from "@workerstack/backend${s.slice(1)}"`)
	const config = { compilerOptions: { ...STRICT, module, moduleResolution: resolution }, include: ["src/**/*.ts"] }
	write(dir, { "src/subpaths.ts": `${lines.join("\n")}\n`, "tsconfig.json": `${JSON.stringify(config, null, 2)}\n` })
	const checked = run("node", [TSC, "-p", "tsconfig.json"], dir)
	return [subpaths.length, checked.code, checked.out]
}

beforeAll(() => {
	tarball = pack(files.out)
	app = consumer(
		join(files.out, "app"),
		{ "@workerstack/backend": `file:${tarball}`, "@workerstack/clients": CLIENTS },
		["zod", "@types/node", "vite"],
	)
	write(app, { "src/app.ts": APP, "src/selectors.ts": SELECTORS })
}, 180_000)
afterAll(() => files.done())

describe.sequential("the tarball, installed (bit 19 i)", () => {
	it(
		"publishes a manifest with no workspace: or catalog: specifier, each dev pin at its repo version",
		{ timeout: SPAWN_TIMEOUT },
		() => {
			const { name, ...fields } = JSON.parse(run("tar", ["-xOzf", tarball, "package/package.json"], files.out).out) as {
				devDependencies: Record<string, string>
				name: string
			}
			const unresolved = JSON.stringify(fields).match(/"(?:workspace|catalog):[^"]*"/g) ?? []
			/* the clients pin is read from the checkout rather than written here, so a dependency bump needs no edit */
			expect([
				name,
				unresolved,
				fields.devDependencies["@workerstack/clients"],
				fields.devDependencies.typescript,
			]).toEqual(["@workerstack/backend", [], CLIENTS, "7.0.2"])
		},
	)

	it("publishes no honey-source condition, which names the src/ a tarball does not ship", () => {
		/* a process that sets the condition (the bin's Bun hand-off, an app's generate) resolves an installed package
		 * through it, so a published honey-source sends that process to a missing file */
		const published = readFileSync(join(app, "node_modules/@workerstack/backend/package.json"), "utf8")
		expect(JSON.stringify(JSON.parse(published))).not.toContain('"honey-source"')
	})

	it("carries bin/, dist/, the README and the license but no source, and every export's files", () => {
		const root = join(app, "node_modules/@workerstack/backend")
		const missing: string[] = []
		for (const [subpath, target] of Object.entries(manifest("@workerstack/backend").exports)) {
			/* every condition an install resolves */
			const conditions = typeof target === "string" ? { default: target } : target
			for (const [condition, file] of Object.entries(conditions))
				if (!existsSync(join(root, file))) missing.push(`${subpath} ${condition} ${file}`)
		}
		expect([readdirSync(root).sort(), missing]).toEqual([["LICENSE", "README.md", "bin", "dist", "package.json"], []])
	})

	it("honey generate in the install writes the app's artifacts through the tarball's dist/build/artifacts", () => {
		const generated = run(
			"node",
			["node_modules/.bin/honey", "generate", "--app", "src/app.ts", "--tree", "--types"],
			app,
		)
		const tree = join(app, "src/_gen/routes.gen.ts")
		expect([generated.code, existsSync(tree), existsSync(join(app, "src/_gen/types.gen.d.ts"))], generated.out).toEqual(
			[0, true, true],
		)
		expect(readFileSync(tree, "utf8")).toContain('"health"')
	}, 60_000)

	/* Vite's own Node chunk makes follow-redirects' errors with a non-Error captureStackTrace at load: on Bun, once jiti's
	 * Babel has hooked Error.prepareStackTrace, that throws "First argument must be an Error object" (bit 20 k-fix) */
	it("honey generate on Bun in the install, a cold jiti cache, reads a config importing vite, a throwing one once", () => {
		const cold = join(files.out, "cold-tmp")
		mkdirSync(cold)
		const generate = () =>
			run("bun", ["node_modules/.bin/honey", "generate"], app, { HONEY_NO_BUN_HANDOFF: "1", TMPDIR: cold })
		const log = join(app, "evaluations.log")
		try {
			write(app, {
				"vite.config.ts":
					'import { defaultClientConditions } from "vite"\nimport { honeyPlugin } from "@workerstack/backend/plugin"\nexport default { resolve: { conditions: [...defaultClientConditions] }, plugins: [honeyPlugin({ app: "src/app.ts" })] }\n',
			})
			const read = generate()
			write(app, {
				"vite.config.ts": `import { appendFileSync } from "node:fs"\nappendFileSync(${JSON.stringify(log)}, "x")\nthrow new Error("boom at load")\n`,
			})
			const thrown = generate()
			expect([
				read.code,
				read.out.split("\n")[0],
				thrown.code,
				thrown.out.split("\n")[0],
				readFileSync(log, "utf8"),
			]).toEqual([0, "honey: generated", 1, "honey: generation failed: boom at load", "x"])
		} finally {
			rmSync(join(app, "vite.config.ts"), { force: true })
			rmSync(log, { force: true })
		}
	}, 60_000)

	it.each([
		["Bundler", "ESNext"],
		["NodeNext", "NodeNext"],
	])(
		"type-checks against every core subpath, the generated types included, with %s resolution and every strict flag",
		(resolution, module) => {
			expect(strictCheck(app, resolution, module)).toEqual([58, 0, ""])
		},
		60_000,
	)

	it("type-checks against every core subpath with honey-clients, an optional peer, not installed", () => {
		const dir = consumer(join(files.out, "core-only"), { "@workerstack/backend": `file:${tarball}` }, ["@types/node"])
		expect(strictCheck(dir, "Bundler", "ESNext")).toEqual([58, 0, ""])
	}, 60_000)
})

/* the honey bin's own file in a package laid out as an install (no tsconfig.json) or a checkout, each entry marked */
let layouts = 0
function binLayout(checkout: boolean): string {
	const dir = join(files.out, `bin-honey-${checkout ? "checkout" : "install"}-${++layouts}`)
	const main = (from: string) => `export function main() {\n\tconsole.log(${JSON.stringify(from)})\n\treturn 0\n}\n`
	write(dir, {
		"bin/honey.js": readFileSync(join(CORE, "bin/honey.js"), "utf8"),
		"dist/build/cli.js": main("dist"),
		"package.json": '{ "type": "module" }\n',
		"src/build/cli.ts": main("source").replace("main()", "main(): number"),
		...(checkout ? { "tsconfig.json": "{}\n" } : {}),
	})
	mkdirSync(join(dir, "node_modules"), { recursive: true })
	symlinkSync(join(REPO, "node_modules/jiti"), join(dir, "node_modules/jiti"), "dir")
	return dir
}

/* as a user starts it: not a child of `bun run`, which would hand over to Bun */
function runBin(runtime: string, dir: string): string {
	return run(runtime, [join(dir, "bin/honey.js")], dir, { npm_config_user_agent: "", npm_execpath: "" }).out.trim()
}

describe("the shipped honey bin picks what it runs (bit 19 i)", () => {
	// v0: 4982f5f697
	it(
		"on Node in a repository checkout runs the source, never a possibly stale dist/",
		{ timeout: SPAWN_TIMEOUT },
		() => {
			expect(runBin("node", binLayout(true))).toBe("source")
		},
	)

	// v0: 13cea3f296
	it("on Node in an installed package (no tsconfig.json) runs the compiled dist/", { timeout: SPAWN_TIMEOUT }, () => {
		expect(runBin("node", binLayout(false))).toBe("dist")
	})

	it("on Bun in an installed package runs dist/ too: the tarball ships no source", { timeout: SPAWN_TIMEOUT }, () => {
		expect(runBin("bun", binLayout(false))).toBe("dist")
	})
})

describe("ws, core's optional peer, in a real install (bit 19 i)", () => {
	/* one process: the upgrade fails naming the package, `npm install ws` runs, and the next upgrade works */
	const SERVER = [
		'import { execFileSync } from "node:child_process"',
		'import { honey } from "@workerstack/backend"',
		'import { serve } from "@workerstack/backend/node"',
		'import { ws } from "@workerstack/backend/ws"',
		"const app = honey()",
		'ws(app, "/live").handler({ onMessage: (_ctx, ws, data) => ws.send(data) })',
		'const server = await serve(app, { hostname: "127.0.0.1", port: 0 })',
		"const echo = () => new Promise((done) => {",
		"\tconst client = new WebSocket(`ws://127.0.0.1:${server.port}/live`)",
		'\tclient.onopen = () => client.send("hi")',
		"\tclient.onmessage = (e) => { done(`echo ${e.data}`); client.close() }",
		'\tclient.onerror = () => done("refused")',
		"})",
		"const before = await echo()",
		'execFileSync("npm", ["install", "ws@8.21.0", "--no-audit", "--no-fund", "--prefer-offline", "--silent"])',
		"const after = await echo()",
		"console.log(`result ${JSON.stringify({ after, before })}`)",
		"await server.close(100)",
		"",
	].join("\n")

	// v0: ddd820848a
	it("fails the upgrade with an install hint without ws, and works once ws is installed (not cached)", () => {
		const dir = consumer(join(files.out, "ws"), { "@workerstack/backend": `file:${tarball}` })
		writeFileSync(join(dir, "server.mjs"), SERVER)
		/* a served app's environment: NODE_ENV=test, which this runner sets, silences the default logger */
		const ran = run("node", ["server.mjs"], dir, { NODE_ENV: "production" })
		const line = ran.out.split("\n").find((l) => l.startsWith("result ")) ?? "result {}"
		const hinted = ran.out.split("result ")[0]?.includes("npm install ws")
		expect([JSON.parse(line.slice(7)), hinted], ran.out).toEqual([{ after: "echo hi", before: "refused" }, true])
	}, 90_000)
})
