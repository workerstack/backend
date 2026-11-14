/**
 * backendPlugin(), the Vite plugin (bit 19 h2): one plugin named backend carrying its config for `backend generate`; the virtual
 * route tree (JavaScript, in a real dev server too), manifest and document; a generation at build start (one across
 * Vite's environments), and on a watched save in dev (one per save across environments, never for a generated file
 * or a temp file, the route tree joining HMR); with a config file, each generation a child that sees edited imports.
 */
import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { appSource, type Project, project } from "./__fixtures__/project.ts"
import type { BackendPluginConfig } from "./config.ts"
import { defaultClientConditions, defaultServerConditions } from "vite"
import {
	backendPlugin,
	NO_OUTPUT_CHECK,
	oncePerKey,
	SAVES_REMEMBERED,
	toJavaScript,
	withoutOutputCheck,
} from "./plugin.ts"

const SLOW = 60_000
const ROUTES = "\0virtual:backend/routes"
const projects: Project[] = []
afterEach(() => {
	for (const made of projects.splice(0)) made.done()
})

/** A fresh project of `files`, removed after the leg. */
function fresh(files: Record<string, string> = {}): Project {
	const made = project(files)
	projects.push(made)
	return made
}

/** The plugin backendPlugin() returns, resolved at `root` as Vite resolves it. */
function pluginAt(config: BackendPluginConfig, root?: string) {
	const [plugin] = backendPlugin(config)
	if (root !== undefined) plugin.configResolved({ root })
	return plugin
}

/** An app module that appends to `evaluations.log` each time it is evaluated, so a leg can count generations. */
function counted(made: Project): () => number {
	const log = join(made.dir, "evaluations.log")
	made.write(
		"src/app.ts",
		`import { appendFileSync } from "node:fs"\nappendFileSync(${JSON.stringify(log)}, "x")\n${appSource()}`,
	)
	return () => (existsSync(log) ? readFileSync(log, "utf8").length : 0)
}

const graph = (found: unknown) => ({ moduleGraph: { getModuleById: vi.fn(() => found) } })
const tree = (dir: string) => readFileSync(join(dir, "src/_gen/routes.gen.ts"), "utf8")

describe("backendPlugin() (bit 19 h2)", () => {
	// v0: 82d46bf4d5
	// v0: 6c71b279c9
	// v0: a242b669a8
	it("is one plugin named backend that carries its config for backend generate", () => {
		const config = { app: "src/app.ts" }
		const plugins = backendPlugin(config)
		expect([plugins.length, plugins[0].name, plugins[0].api.backendConfig]).toEqual([1, "backend", config])
	})

	// v0: dccdaa093c
	// v0: 0ddf313f4d
	it("resolves the route tree always, and the manifest and document only when configured", () => {
		const on = pluginAt({ app: "src/app.ts", codegen: { manifest: true, openApi: { title: "T", version: "1" } } })
		const off = pluginAt({ app: "src/app.ts" })
		const ids = ["virtual:backend/routes", "virtual:backend/manifest", "virtual:backend/openapi", "./other"]
		expect([ids.map((id) => on.resolveId(id)), ids.map((id) => off.resolveId(id))]).toEqual([
			["\0virtual:backend/routes", "\0virtual:backend/manifest", "\0virtual:backend/openapi", undefined],
			["\0virtual:backend/routes", undefined, undefined, undefined],
		])
	})

	// v0: 5f20f383c2
	// v0: c896cc29ce
	it(
		"loads the route tree as JavaScript, the manifest and document as modules, and nothing for another id",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			const plugin = pluginAt(
				{ app: "src/app.ts", codegen: { manifest: true, openApi: { title: "T", version: "1" } } },
				dir,
			)
			const routes = await plugin.load(ROUTES)
			expect([routes?.moduleType, routes?.code.includes("GET /health")]).toEqual(["js", true])
			/* JavaScript, not the TypeScript the tree codegen writes to disk */
			expect(routes?.code).not.toMatch(/import type|: TreeNode|as unknown as/)
			const manifest = await plugin.load("\0virtual:backend/manifest")
			const document = await plugin.load("\0virtual:backend/openapi")
			expect([manifest?.code.startsWith("export default {"), document?.code.includes('"title":"T"')]).toEqual([
				true,
				true,
			])
			expect(await plugin.load("./other.ts")).toBeUndefined()
			expect(await pluginAt({ app: "src/app.ts" }, dir).load("\0virtual:backend/openapi")).toBeUndefined()
			expect(await pluginAt({ app: "src/app.ts" }, dir).load("\0virtual:backend/manifest")).toBeUndefined()
		},
		SLOW,
	)
})

describe("backendPlugin() (bit 19 h2), continued (2)", () => {
	// v0: add50a69c3
	it(
		"builds the virtual document with its output's profile",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			const plugin = pluginAt(
				{ app: "src/app.ts", codegen: { openApi: { profile: "nope", title: "T", version: "1" } } },
				dir,
			)
			/* an unknown profile is refused, which proves the profile reached generateOpenApi */
			await expect(plugin.load("\0virtual:backend/openapi")).rejects.toThrow(/profile/i)
		},
		SLOW,
	)

	// v0: bf67e0518d
	it(
		"serves the virtual route tree in a real Vite dev server",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			const { createServer } = await import("vite")
			const server = await createServer({
				configFile: false,
				logLevel: "silent",
				plugins: backendPlugin({ app: "src/app.ts", codegen: { tree: false } }),
				root: dir,
				server: { middlewareMode: true, ws: false },
			})
			try {
				const mod = (await server.ssrLoadModule("virtual:backend/routes")) as { routeTree?: { routes: object } }
				expect(Object.keys(mod.routeTree?.routes ?? {})).toEqual(["GET /health", "POST /items"])
			} finally {
				await server.close()
			}
		},
		SLOW,
	)
})

describe("backendPlugin() at build start (bit 19 h2)", () => {
	// v0: 0bc0d6a701
	// v0: e459c5305b
	// v0: d27db436ac
	it(
		"writes the route tree, the document with its JSON Schema bodies, and the manifest",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			await pluginAt(
				{
					app: "src/app.ts",
					codegen: { manifest: true, openApi: { formats: ["json", "yaml"], title: "Test", version: "2.0" } },
				},
				dir,
			).buildStart()
			expect(tree(dir)).toMatch(/"GET \/health"[\s\S]*"POST \/items"/)
			const document = JSON.parse(readFileSync(join(dir, "src/_gen/openapi.gen.json"), "utf8")) as {
				info: { title: string }
				paths: Record<string, { post?: { requestBody?: { content: Record<string, { schema: object }> } } }>
			}
			expect([
				document.info.title,
				document.paths["/items"]?.post?.requestBody?.content["application/json"]?.schema,
			]).toEqual(["Test", { $ref: "#/components/schemas/CreateItemRequest" }])
			expect(readFileSync(join(dir, "src/_gen/openapi.gen.yaml"), "utf8")).toMatch(/title: Test[\s\S]*\/items:/)
			const manifest = JSON.parse(readFileSync(join(dir, "src/_gen/manifest.gen.json"), "utf8")) as {
				routes: unknown[]
			}
			expect(manifest.routes).toHaveLength(2)
		},
		SLOW,
	)

	// v0: d9c5a2484f
	// v0: 593dc013be
	it(
		"writes to custom paths, and no tree when it is off",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			await pluginAt(
				{ app: "src/app.ts", codegen: { manifest: "gen/manifest.json", tree: "gen/routes.gen.ts" } },
				dir,
			).buildStart()
			expect(["gen/routes.gen.ts", "gen/manifest.json"].map((path) => existsSync(join(dir, path)))).toEqual([
				true,
				true,
			])
			const off = fresh({ "src/app.ts": appSource() })
			await pluginAt({ app: "src/app.ts", codegen: { tree: false } }, off.dir).buildStart()
			expect(existsSync(join(off.dir, "src/_gen/routes.gen.ts"))).toBe(false)
		},
		SLOW,
	)
})

describe("backendPlugin() at build start (bit 19 h2), continued (2)", () => {
	// v0: 56527a95bd
	it(
		"runs one generation when Vite starts two environments back to back, and anew on a later build",
		async () => {
			const made = fresh()
			const evaluations = counted(made)
			const plugin = pluginAt({ app: "src/app.ts" }, made.dir)
			await Promise.all([plugin.buildStart(), plugin.buildStart()])
			expect(evaluations()).toBe(1)
			await plugin.buildStart()
			expect(evaluations()).toBe(2)
		},
		SLOW,
	)

	// v0: e05ef8636e
	it(
		"with a config file, generates in a child that sees edits to the modules the app imports",
		async () => {
			const made = fresh({
				"src/app.ts":
					'import { httpApp } from "@workerstack/backend/http"\nimport { path } from "./routes.ts"\nexport const app = httpApp().get(path).handler((c) => c.res.text("ok", "ok"))\n',
				"src/routes.ts": 'export const path = "/first"\n',
				"vite.config.ts":
					'import { backendPlugin } from "@workerstack/backend/plugin"\nexport default { plugins: [backendPlugin({ app: "src/app.ts", codegen: { tree: "src/_gen/routes.gen.ts" } })] }\n',
			})
			const [plugin] = backendPlugin({ app: "src/app.ts" })
			const configFile = join(made.dir, "vite.config.ts")
			plugin.configResolved({ command: "build", configFile, plugins: [{ name: "other" }, plugin], root: made.dir })
			await plugin.buildStart()
			expect(tree(made.dir)).toContain('"GET /first"')
			made.write("src/routes.ts", 'export const path = "/second"\n')
			await plugin.buildStart()
			expect(tree(made.dir)).toContain('"GET /second"')
		},
		SLOW,
	)

	it(
		"fails a build start whose child generation fails, naming how it ended",
		async () => {
			const made = fresh({ "vite.config.ts": "export default { plugins: [] }\n" })
			const [plugin] = backendPlugin({ app: "src/app.ts" })
			plugin.configResolved({ configFile: join(made.dir, "vite.config.ts"), plugins: [plugin], root: made.dir })
			await expect(plugin.buildStart()).rejects.toThrow("backend generate failed (exit 1)")
		},
		SLOW,
	)
})

describe("backendPlugin() on a save in dev (bit 19 h2)", () => {
	// v0: 88cc84efdc
	it(
		"regenerates on a watched save and lets HMR go on, the route tree joining the update",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, dir)
			const [routes, edited] = [{ id: ROUTES }, { id: join(dir, "src/app.ts") }]
			const result = await plugin.hotUpdate({ file: join(dir, "src/app.ts"), modules: [edited], server: graph(routes) })
			expect(result).toEqual([edited, routes])
			expect(tree(dir)).toContain('"GET /health"')
			/* already part of the update: left as it is */
			expect(
				await plugin.hotUpdate({ file: join(dir, "src/app.ts"), modules: [routes], server: graph(routes) }),
			).toBeUndefined()
		},
		SLOW,
	)

	// v0: 963c059016
	it(
		"leaves HMR alone when no module imports the virtual route tree",
		async () => {
			const { dir } = fresh({ "src/app.ts": appSource() })
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, dir)
			expect(
				await plugin.hotUpdate({ file: join(dir, "src/app.ts"), modules: [], server: graph(undefined) }),
			).toBeUndefined()
		},
		SLOW,
	)

	// v0: 9d8e902099
	it(
		"generates once per save across environments, reading the environment's own module graph",
		async () => {
			const made = fresh()
			const evaluations = counted(made)
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, made.dir)
			const save = { file: join(made.dir, "src/app.ts"), modules: [], server: graph(undefined), timestamp: 42 }
			const environment = graph(null)
			await plugin.hotUpdate.call({ environment }, save)
			await plugin.hotUpdate.call({ environment }, save)
			expect([evaluations(), environment.moduleGraph.getModuleById.mock.calls.length]).toEqual([1, 2])
			await plugin.hotUpdate.call({ environment }, { ...save, timestamp: 43 })
			expect(evaluations()).toBe(2)
		},
		SLOW,
	)
})

describe("backendPlugin() on a save in dev (bit 19 h2), continued (2)", () => {
	// v0: 28ce361b76
	// v0: 82f8d40099
	// v0: 1257be6d78
	it(
		"never generates for a generated output, an atomic write's temp file, or a file no glob matches",
		async () => {
			const made = fresh()
			const evaluations = counted(made)
			const plugin = pluginAt(
				{ app: "src/app.ts", codegen: { manifest: "out/manifest.json" }, watch: ["**/*"] },
				made.dir,
			)
			const narrow = pluginAt({ app: "src/app.ts", watch: ["src/routes/**/*.ts"] }, made.dir)
			const unwatched = pluginAt({ app: "src/app.ts" }, made.dir)
			const server = graph(undefined)
			for (const file of ["src/_gen/routes.gen.ts", "out/manifest.json", "src/.4242.ab12cd.tmp"])
				await plugin.hotUpdate({ file: join(made.dir, file), modules: [], server })
			await narrow.hotUpdate({ file: join(made.dir, "src/utils/helper.ts"), modules: [], server })
			await unwatched.hotUpdate({ file: join(made.dir, "src/app.ts"), modules: [], server })
			expect([evaluations(), server.moduleGraph.getModuleById.mock.calls.length]).toEqual([0, 0])
		},
		SLOW,
	)

	it(
		"reports a failed generation on a save and still lets HMR go on",
		async () => {
			const made = fresh({ "src/app.ts": "export const app = 1\n" })
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, made.dir)
			const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
			const result = await plugin.hotUpdate({
				file: join(made.dir, "src/app.ts"),
				modules: [],
				server: graph(undefined),
			})
			expect([result, String(stderr.mock.calls[0]?.[0])]).toEqual([
				undefined,
				`backend: generation failed: Error: Expected a backend app as the app or default export of ${join(made.dir, "src/app.ts")}\n`,
			])
			stderr.mockRestore()
			rmSync(join(made.dir, "src/app.ts"))
		},
		SLOW,
	)
})

describe("backendPlugin() under load (bit 19 h2)", () => {
	it(
		"queues one generation behind a running one, every save meanwhile joining it",
		async () => {
			const made = fresh()
			const evaluations = counted(made)
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, made.dir)
			const save = (timestamp: number) =>
				plugin.hotUpdate({ file: join(made.dir, "src/app.ts"), modules: [], server: graph(undefined), timestamp })
			await Promise.all([save(1), save(2), save(3)])
			expect(evaluations()).toBe(2)
		},
		SLOW,
	)

	it("runs once per save key, and forgets all but the last SAVES_REMEMBERED keys, so an old one runs again", async () => {
		let runs = 0
		const perSave = oncePerKey(async () => void runs++, SAVES_REMEMBERED)
		await Promise.all([perSave("a.ts\u00001"), perSave("a.ts\u00001")])
		expect(runs).toBe(1)
		for (let save = 2; save <= SAVES_REMEMBERED + 1; save++) await perSave(`a.ts\u0000${save}`)
		await perSave(`a.ts\u0000${SAVES_REMEMBERED + 1}`)
		expect(runs).toBe(SAVES_REMEMBERED + 1)
		await perSave("a.ts\u00001")
		expect(runs).toBe(SAVES_REMEMBERED + 2)
	})

	it(
		"passes Vite's mode to its generation child",
		async () => {
			const made = fresh({
				"src/app.ts": appSource(),
				"vite.config.ts":
					'import { backendPlugin } from "@workerstack/backend/plugin"\nexport default ({ mode }) => ({ plugins: [backendPlugin({ app: "src/app.ts", codegen: { manifest: mode === "staging" } })] })\n',
			})
			const [plugin] = backendPlugin({ app: "src/app.ts" })
			plugin.configResolved({
				command: "serve",
				configFile: join(made.dir, "vite.config.ts"),
				mode: "staging",
				plugins: [plugin],
				root: made.dir,
			})
			await plugin.buildStart()
			expect(existsSync(join(made.dir, "src/_gen/manifest.gen.json"))).toBe(true)
		},
		SLOW,
	)
})

describe("backendPlugin() under load (bit 19 h2), continued (2)", () => {
	it("serves the route tree as TypeScript when Vite or its transform is not there", async () => {
		const code = "const a: number = 1\n"
		const missing = await toJavaScript(code, () => Promise.reject(new Error("no vite")))
		const bare = await toJavaScript(code, async () => ({}))
		expect([missing, bare]).toEqual([
			{ code, moduleType: "ts" },
			{ code, moduleType: "ts" },
		])
	})
})

describe("backendPlugin() under load, failing (bit 19 h2)", () => {
	it(
		"runs the generation queued behind a failed one, each failure reported",
		async () => {
			const made = fresh({ "src/app.ts": "export const app = 1\n" })
			const plugin = pluginAt({ app: "src/app.ts", watch: ["src/**/*.ts"] }, made.dir)
			const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
			const save = (timestamp: number) =>
				plugin.hotUpdate({ file: join(made.dir, "src/app.ts"), modules: [], server: graph(undefined), timestamp })
			await Promise.all([save(1), save(2)])
			const reports = stderr.mock.calls
				.map(([chunk]) => String(chunk))
				.filter((line) => line.startsWith("backend: generation failed"))
			stderr.mockRestore()
			expect(reports).toHaveLength(2)
		},
		SLOW,
	)

	it(
		"takes development as the mode of a dev server that names none",
		async () => {
			const made = fresh({
				"src/app.ts": appSource(),
				"vite.config.ts":
					'import { backendPlugin } from "@workerstack/backend/plugin"\nexport default ({ mode }) => ({ plugins: [backendPlugin({ app: "src/app.ts", codegen: { manifest: mode === "development" } })] })\n',
			})
			const [plugin] = backendPlugin({ app: "src/app.ts" })
			plugin.configResolved({
				command: "serve",
				configFile: join(made.dir, "vite.config.ts"),
				plugins: [plugin],
				root: made.dir,
			})
			await plugin.buildStart()
			expect(existsSync(join(made.dir, "src/_gen/manifest.gen.json"))).toBe(true)
		},
		SLOW,
	)
})

describe("backendPlugin() and the output check (plan 40)", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("adds the no-op's condition alone to a set list, and before Vite's own defaults to an unset one", async () => {
		const build = { command: "build" } as const
		expect(
			await Promise.all([
				withoutOutputCheck("ssr", { resolve: { conditions: ["backend-source", "workerd"] } }, build),
				withoutOutputCheck("client", {}, build),
				withoutOutputCheck("ssr", {}, build),
				withoutOutputCheck("worker", { consumer: "client" }, build),
				withoutOutputCheck("ssr", { resolve: {} }, { command: "build", isSsrTargetWebworker: true }),
			]),
		).toEqual([
			{ resolve: { conditions: [NO_OUTPUT_CHECK] } },
			{ resolve: { conditions: [NO_OUTPUT_CHECK, ...defaultClientConditions] } },
			{ resolve: { conditions: [NO_OUTPUT_CHECK, ...defaultServerConditions] } },
			{ resolve: { conditions: [NO_OUTPUT_CHECK, ...defaultClientConditions] } },
			{ resolve: { conditions: [NO_OUTPUT_CHECK, ...defaultClientConditions] } },
		])
	})

	it("drops the check in a production build only: never under serve, a development build, or outputValidation: true", async () => {
		const [plugin] = backendPlugin({ app: "src/app.ts" })
		const [kept] = backendPlugin({ app: "src/app.ts", outputValidation: true })
		const env = { resolve: { conditions: ["workerd"] } }
		vi.stubEnv("NODE_ENV", "development")
		const development = await plugin.configEnvironment("ssr", env, { command: "build" })
		vi.stubEnv("NODE_ENV", "production")
		expect([
			development,
			await plugin.configEnvironment("ssr", env, { command: "serve" }),
			await kept.configEnvironment("ssr", env, { command: "build" }),
			await plugin.configEnvironment("ssr", env, { command: "build" }),
		]).toEqual([undefined, undefined, undefined, { resolve: { conditions: [NO_OUTPUT_CHECK] } }])
	})

	it("refuses a build that dropped the check once Vite resolves it as development (a .env file's NODE_ENV)", async () => {
		const [plugin] = backendPlugin({ app: "src/app.ts" })
		vi.stubEnv("NODE_ENV", "production")
		await plugin.configEnvironment("client", {}, { command: "build" })
		expect(() => plugin.configResolved({ isProduction: false, root: process.cwd() })).toThrow(
			/dropped the output check under NODE_ENV=production, and Vite then read NODE_ENV=development/,
		)
		expect(() => plugin.configResolved({ isProduction: true, root: process.cwd() })).not.toThrow()
	})
})
