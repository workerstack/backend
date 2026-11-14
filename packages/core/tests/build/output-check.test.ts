/**
 * Where the answer check lives (plan 40, phase 10): `#output-check` in the installed package. The real core tarball is
 * installed beside the repo's Vite and an app whose `/bad` route answers what its `.output()` refuses. A Worker that
 * `vite build` bundles through `honeyPlugin()` in production carries none of the check, built unminified so its one
 * marker, the `compileOutput` function only the check defines, would show; a development build, and a production
 * build with `honeyPlugin({ outputValidation: true })`, carry it and answer `/bad` with the 500.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SPAWN_TIMEOUT } from "../fixture/spawn-timeout.ts"
import { consumer, pack, run, scratch, write } from "./fixture/packed.ts"

const files = scratch("output-check")
let dir = ""

const MARKER = "function compileOutput("

/* one route that answers what its .output() refuses, one with no .output(); a schema of its own, so no validator
 * library is installed */
const APP = `import { honey } from "@workerstack/backend/http"
const row = {
	"~standard": {
		validate: (value) => (typeof value?.id === "string" ? { value } : { issues: [{ message: "id is no string" }] }),
		vendor: "fixture",
		version: 1,
	},
}
export const app = honey().logger(false)
app.get("/health").handler((ctx) => ctx.res.text("ok", "ok"))
app.get("/bad").output({ ok: row }).handler((ctx) => ctx.res.json("ok", { id: 1 }))
`

/* vite build of src/app.mjs for argv's target into argv's directory, unminified; "keep" sets outputValidation */
const BUILD = `import { build } from "vite"
import { createBuildPlugin } from "@workerstack/backend/build"
import { honeyPlugin } from "@workerstack/backend/plugin"
const [target, outDir, keep] = process.argv.slice(2)
await build({
	configFile: false,
	logLevel: "error",
	plugins: [
		honeyPlugin({ app: "src/app.mjs", codegen: { tree: false }, ...(keep === "keep" ? { outputValidation: true } : {}) }),
		createBuildPlugin({ minify: false, outDir, target }, { entry: "src/app.mjs", export: "app" }),
	],
	root: process.cwd(),
})
`

/* what a Worker module answers for /bad, called the way workerd calls its default export */
const CALL_WORKER = `const worker = await import(process.argv[2])
const answer = await worker.default.fetch(new Request("http://localhost/bad"), {}, { passThroughOnException() {}, waitUntil() {} })
console.log(answer.status, await answer.text())
`

beforeAll(() => {
	dir = consumer(join(files.out, "app"), { "@workerstack/backend": `file:${pack(files.out)}` }, ["vite"])
	write(dir, { "build.mjs": BUILD, "call-worker.mjs": CALL_WORKER, "src/app.mjs": APP })
}, 180_000)
afterAll(() => files.done())

/** `vite build` for `target` under `nodeEnv`, into dist/`name`: the bundle's text. */
function built(name: string, target: "workers", nodeEnv: string, keep = false): string {
	const out = run("node", ["build.mjs", target, `dist/${name}`, keep ? "keep" : ""], dir, { NODE_ENV: nodeEnv })
	expect(out.code, out.out).toBe(0)
	return readFileSync(join(dir, `dist/${name}/index.js`), "utf8")
}

/** An answer as its status and, for a 500, its error key, else its body. */
function seen(status: number, text: string): string {
	return `${status} ${status === 500 ? (JSON.parse(text) as { error_key: string }).error_key : text}`
}

/** What the Worker built as dist/`name` answers for /bad. */
function workerAnswer(name: string): string {
	const out = run("node", ["call-worker.mjs", join(dir, `dist/${name}/index.js`)], dir)
	expect(out.code, out.out).toBe(0)
	const [status = "", ...text] = out.out.trim().split(" ")
	return seen(Number(status), text.join(" "))
}

const REFUSED = "500 output_validation_failed"

describe("a Worker built through honeyPlugin() (plan 40, phase 10)", () => {
	// v0: ac3e0f763d
	it(
		"in production carries no output check, and answers what its handler built",
		() => {
			const js = built("workers-production", "workers", "production")
			expect([js.includes(MARKER), workerAnswer("workers-production")]).toEqual([false, '200 {"id":1}'])
		},
		SPAWN_TIMEOUT,
	)

	// v0: f911fe03b0
	it(
		"in development carries the check, and answers the mismatch with the 500",
		() => {
			const js = built("workers-development", "workers", "development")
			expect([js.includes(MARKER), workerAnswer("workers-development")]).toEqual([true, REFUSED])
		},
		SPAWN_TIMEOUT,
	)

	it(
		"in production with outputValidation: true carries the check, and answers the mismatch with the 500",
		() => {
			const js = built("workers-kept", "workers", "production", true)
			expect([js.includes(MARKER), workerAnswer("workers-kept")]).toEqual([true, REFUSED])
		},
		SPAWN_TIMEOUT,
	)
})
