/**
 * What ships (bit 19 i): the real tarball of `@workerstack/backend`, packed by npm and installed into a consumer outside
 * the repo beside `@workerstack/clients` at the version core pins. The install carries every export's files,
 * type-checks against every core subpath under maximal strictness, runs the bin from dist/, and generates an app's artifacts through the
 * tarball's own `build/artifacts` (generate.ts `artifactsFor`). A bin picks dist/ in an install and the source in a
 * checkout.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CLIENTS, CORE, consumer, pack, REPO, run, scratch, write } from "./fixture/packed.ts"
import { shippedManifest } from "../../../../scripts/pack.ts"
import { SPAWN_TIMEOUT } from "../fixture/spawn-timeout.ts"

const TSC = join(REPO, "node_modules/typescript/bin/tsc")
/* the app imports zod, so it declares it, at the version the repo resolves */
const ZOD = (JSON.parse(readFileSync(join(REPO, "node_modules/zod/package.json"), "utf8")) as { version: string })
	.version
const files = scratch("packaging")
let tarball = ""
let app = ""

const APP = [
	'import { createMiddleware, defineErrors, httpApp } from "@workerstack/backend/http"',
	'import { cors } from "@workerstack/backend/http/cors"',
	'import { serveOpenApi } from "@workerstack/backend/http/openapi"',
	'import { requestId } from "@workerstack/backend/http/request-id"',
	'import { ws } from "@workerstack/backend/ws"',
	'import * as z from "zod"',
	"",
	'const errors = defineErrors({ item_not_found: "not_found" })',
	"",
	"const routes = httpApp<{}>()",
	"\t.errorFactory(errors)",
	"\t.use(requestId())",
	'\t.use(cors({ origin: "http://app.test" }))',
	'\t.use(createMiddleware((_ctx, next) => next({ userId: "u-1" })))',
	'\t.get("/health").meta({ operationId: "health.list" })',
	'\t.handler((ctx) => ctx.res.text("ok", "ok"))',
	'\t.post("/items").meta({ operationId: "items.create" })',
	"\t.input({ json: z.object({ name: z.string() }) })",
	'\t.output({ "application/json": { created: z.object({ name: z.string(), userId: z.string() }) } })',
	'\t.handler((ctx) => ctx.res.json("created", { name: ctx.input.json.name, userId: ctx.userId }))',
	'ws(routes, "/live").meta({ operationId: "live.connect" }).handler({ onMessage(_ctx, socket, data) { socket.send(data) } })',
	"",
	'export const app = serveOpenApi(routes, { title: "Consumer", version: "1.0.0" })',
	"",
].join("\n")

/* the operation slot is the one `backend generate` writes into src/_gen/types.gen.d.ts: each expect-error is unused
 * unless the generated ids narrow, and `live.connect`, a WebSocket id, is no invalidate target */
const OPERATIONS = [
	'import type { HttpMeta, HttpOperationId, OperationId } from "@workerstack/backend/http"',
	"",
	'export const live: OperationId = "live.connect"',
	"// @ts-expect-error an id the app does not declare",
	'export const missing: OperationId = "health.lst"',
	'export const target: HttpOperationId = "health.list"',
	"// @ts-expect-error a WebSocket operation is no invalidate target",
	'export const socket: HttpOperationId = "live.connect"',
	'export const meta: HttpMeta = { invalidate: ["health.list"] }',
	"// @ts-expect-error a target the app does not declare",
	'export const typo: HttpMeta = { invalidate: ["health.lst"] }',
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
		{ "@workerstack/backend": `file:${tarball}`, "@workerstack/clients": CLIENTS, zod: ZOD },
		["@types/node", "vite"],
	)
	write(app, { "src/app.ts": APP, "src/operations.ts": OPERATIONS })
}, 180_000)
afterAll(() => files.done())

describe.sequential("the tarball, installed (bit 19 i)", () => {
	it(
		"publishes a manifest with no devDependencies and no workspace:, catalog:, file:, link: or git specifier",
		{ timeout: SPAWN_TIMEOUT },
		() => {
			const published = JSON.parse(run("tar", ["-xOzf", tarball, "package/package.json"], files.out).out) as {
				devDependencies?: Record<string, string>
				name: string
			} & Record<string, unknown>
			/* a consumer never installs devDependencies, and a vendored file: pin names a tarball no install can reach */
			const specs = ["dependencies", "optionalDependencies", "peerDependencies"].flatMap((field) =>
				Object.values((published[field] ?? {}) as Record<string, string>),
			)
			const unresolved = specs.filter((spec) => /^(?:workspace|catalog|file|link|git(?:\+[a-z]+)?|github):/.test(spec))
			expect([published.name, specs.length > 0, unresolved, published.devDependencies]).toEqual([
				"@workerstack/backend",
				true,
				[],
				undefined,
			])
		},
	)

	it("publishes no backend-source condition, which names the src/ a tarball does not ship", () => {
		/* a process that sets the condition (the bin's Bun hand-off, an app's generate) resolves an installed package
		 * through it, so a published backend-source sends that process to a missing file */
		const published = readFileSync(join(app, "node_modules/@workerstack/backend/package.json"), "utf8")
		expect(JSON.stringify(JSON.parse(published))).not.toContain('"backend-source"')
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

	it("backend generate in the install writes the app's artifacts through the tarball's dist/build/artifacts", () => {
		const generated = run(
			"node",
			["node_modules/.bin/backend", "generate", "--app", "src/app.ts", "--tree", "--types"],
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
	it("backend generate on Bun in the install, a cold jiti cache, reads a config importing vite, a throwing one once", () => {
		const cold = join(files.out, "cold-tmp")
		mkdirSync(cold)
		const generate = () =>
			run("bun", ["node_modules/.bin/backend", "generate"], app, { BACKEND_NO_BUN_HANDOFF: "1", TMPDIR: cold })
		const log = join(app, "evaluations.log")
		try {
			write(app, {
				"vite.config.ts":
					'import { defaultClientConditions } from "vite"\nimport { backendPlugin } from "@workerstack/backend/plugin"\nexport default { resolve: { conditions: [...defaultClientConditions] }, plugins: [backendPlugin({ app: "src/app.ts" })] }\n',
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
			]).toEqual([0, "backend: generated", 1, "backend: generation failed: boom at load", "x"])
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
			expect(strictCheck(app, resolution, module)).toEqual([48, 0, ""])
		},
		60_000,
	)

	it("type-checks against every core subpath with clients, an optional peer, not installed", () => {
		const dir = consumer(join(files.out, "core-only"), { "@workerstack/backend": `file:${tarball}` }, ["@types/node"])
		expect(strictCheck(dir, "Bundler", "ESNext")).toEqual([48, 0, ""])
	}, 60_000)
})

/* the backend bin's own file in a package laid out as an install (no tsconfig.json) or a checkout, each entry marked */
let layouts = 0
function binLayout(checkout: boolean): string {
	const dir = join(files.out, `bin-backend-${checkout ? "checkout" : "install"}-${++layouts}`)
	const main = (from: string) => `export function main() {\n\tconsole.log(${JSON.stringify(from)})\n\treturn 0\n}\n`
	write(dir, {
		"bin/backend.js": readFileSync(join(CORE, "bin/backend.js"), "utf8"),
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
	return run(runtime, [join(dir, "bin/backend.js")], dir, { npm_config_user_agent: "", npm_execpath: "" }).out.trim()
}

describe("the shipped backend bin picks what it runs (bit 19 i)", () => {
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

describe("the packed manifest refuses a spec no install can reach", () => {
	it("names the field, the dependency and its spec for file:, link: and git specs, and keeps a registry range", () => {
		const base = { name: "@workerstack/backend", version: "1.0.0" }
		const refusal = (field: string, spec: string) => {
			try {
				shippedManifest({ ...base, [field]: { x: spec } })
				return "packed"
			} catch (error) {
				return (error as Error).message
			}
		}
		expect([
			refusal("dependencies", "file:vendor/x.tgz"),
			refusal("peerDependencies", "link:../x"),
			refusal("optionalDependencies", "git+https://example.com/x.git"),
			refusal("peerDependencies", ">=1.0.0-rc.27"),
			refusal("devDependencies", "file:vendor/x.tgz"),
		]).toEqual([
			'pack: @workerstack/backend dependencies.x is "file:vendor/x.tgz"; a published manifest names only registry versions',
			'pack: @workerstack/backend peerDependencies.x is "link:../x"; a published manifest names only registry versions',
			'pack: @workerstack/backend optionalDependencies.x is "git+https://example.com/x.git"; a published manifest names only registry versions',
			"packed",
			"packed",
		])
	})
})
