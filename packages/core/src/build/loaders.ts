/**
 * The build tooling's loaders: user modules (the Vite config, the app) through Vite's module runner on Node, so
 * `backend generate` reads a TypeScript config on plain Node (H70b), and through Bun's own import on Bun; and Effect's
 * JSON Schema converter, when effect is installed, for the documents core generates (core never imports a validator, F2).
 */
import { existsSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type * as Vite from "vite"
import type { EffectConverter } from "../schema/to-json-schema.ts"

export type ModuleLoader = (path: string) => Promise<Record<string, unknown>>

export type ModuleLoaderOptions = {
	/** no module shared with an earlier fresh loader: a generation's redo pass sees the tree its first pass wrote */
	fresh: boolean
	/** the file imports resolve from */
	from: string
	/** a fresh loader after one that evaluated the project in this process: it must evict some module */
	reload?: boolean
}

/** Bun's module registry, its ES modules included, keyed by path. */
export type ModuleRegistry = Record<string, unknown>

/**
 * A loader for one generation: each path evaluated at most once, so the app never runs twice, and every path's
 * imports shared in one graph, so an app and the core reading it are one instance. On Node, a Vite module runner of
 * its own: a fresh loader's graph starts empty. On Bun, Bun's own import: a fresh loader first evicts from Bun's
 * registry every module outside node_modules, what a user may have edited or a generation written (a gateway's
 * tree). Not the runner on Bun: its source-map hook is the class of Error.prepareStackTrace replacer that breaks Bun
 * (bit 20 k-fix).
 */
export async function createModuleLoader(
	options: ModuleLoaderOptions,
	registry: ModuleRegistry = createRequire(import.meta.url).cache,
	bun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined",
	vite: () => Promise<typeof Vite> = () => import("vite"),
): Promise<ModuleLoader> {
	const evaluate = bun ? bunEvaluator(options, registry) : await viteEvaluator(options, vite)
	const loaded = new Map<string, Promise<Record<string, unknown>>>()
	return (path) => {
		const abs = resolve(path)
		let mod = loaded.get(abs)
		if (!mod) {
			mod = evaluate(abs)
			loaded.set(abs, mod)
		}
		return mod
	}
}

const INSTALLED = /[\\/]node_modules[\\/]/
const INSTALLED_JS = /[\\/]node_modules[\\/].*\.[cm]?js$/

function bunEvaluator(options: ModuleLoaderOptions, registry: ModuleRegistry) {
	const evicted = options.fresh ? Object.keys(registry).filter((key) => !INSTALLED.test(key)) : []
	for (const key of evicted) delete registry[key]
	/* a registry keyed otherwise than this reads (a runtime upgrade) leaves a reload the stale graph: said, not served */
	if (options.reload === true && evicted.length === 0)
		throw new Error("the module registry held none of the project's modules to evict: a reload would read them stale")
	return (path: string) => import(pathToFileURL(path).href) as Promise<Record<string, unknown>>
}

/**
 * Vite's SSR runner rooted at the importing file's directory, resolving by the conditions this runtime was started
 * with, so a linked package resolves to the file Node would pick. The user's Vite config is never applied to it. The
 * server holds no handle (no socket, no watcher, no dependency scan), so it is left for the process to end.
 */
async function viteEvaluator(options: ModuleLoaderOptions, vite: () => Promise<typeof Vite>) {
	const { createServer, createServerModuleRunner, defaultServerConditions } = await vite().catch((error: Error) => {
		if (error.message.startsWith("Cannot find package 'vite' "))
			throw new Error("backend generate on Node loads TypeScript through Vite: install vite, or run it with Bun")
		throw error
	})
	const conditions = [...defaultServerConditions, ...runtimeConditions()]
	const server = await createServer({
		appType: "custom",
		configFile: false,
		logLevel: "silent",
		/* nothing here serves a browser: no dependency scan of the root */
		optimizeDeps: { entries: [], noDiscovery: true },
		resolve: { conditions },
		root: dirname(options.from),
		server: { middlewareMode: true, watch: null, ws: false },
		ssr: { resolve: { conditions, externalConditions: runtimeConditions() } },
	})
	/* its own source-map hook, not Node's: a stack frame names the user's line even where another hook owns stacks */
	const runner = createServerModuleRunner(server.environments.ssr, {
		hmr: false,
		sourcemapInterceptor: "prepareStackTrace",
	})
	/* an installed JavaScript file is imported natively, as Vite externalizes the app's installed JavaScript, so both
	 * share one instance; an installed TypeScript file Vite runs itself, so the runner does here too */
	return (path: string) =>
		(INSTALLED_JS.test(realpathSync(path)) ? import(pathToFileURL(path).href) : runner.import(path)) as Promise<
			Record<string, unknown>
		>
}

/** Every `--conditions`/`-C` this Node process was started with, from its arguments and from NODE_OPTIONS. */
function runtimeConditions(): string[] {
	const args = [...process.execArgv, ...(process.env.NODE_OPTIONS ?? "").split(/\s+/)]
	return args.flatMap((arg, index) => {
		const inline = /^(?:--conditions|-C)=(.+)$/.exec(arg)
		if (inline) return [inline[1] as string]
		const next = args[index + 1]
		return (arg === "--conditions" || arg === "-C") && next !== undefined ? [next] : []
	})
}

export const VITE_CONFIG_FILES: readonly string[] = [
	"vite.config.ts",
	"vite.config.mts",
	"vite.config.cts",
	"vite.config.js",
	"vite.config.mjs",
	"vite.config.cjs",
]

/** The Vite config file in `cwd`, by Vite's own order; undefined when there is none. */
export function findViteConfig(cwd: string): string | undefined {
	return VITE_CONFIG_FILES.map((name) => join(cwd, name)).find((path) => existsSync(path))
}

export type ViteConfigEnv = { command: "build" | "serve"; mode: string }

/**
 * The config each `backendPlugin()` in a Vite config file carries, in plugin order: a function-form config is called
 * with `env`, and nested and promised plugin arrays flatten as Vite flattens them. Read off the plugin object (its
 * name `backend`, its `api.backendConfig`), so it holds across module instances and runtimes.
 */
export async function loadPluginConfigs<T>(configPath: string, load: ModuleLoader, env: ViteConfigEnv): Promise<T[]> {
	const mod = await load(configPath)
	let config: unknown = "default" in mod ? mod.default : mod
	if (typeof config === "function") {
		config = (config as (env: object) => unknown)({ ...env, isPreview: false, isSsrBuild: false })
	}
	const plugins = await flattened((await config) as { plugins?: unknown } | null | undefined)
	return plugins.flatMap((plugin) => {
		const p = plugin as { api?: { backendConfig?: T }; name?: unknown } | null
		return p?.name === "backend" && p.api?.backendConfig !== undefined ? [p.api.backendConfig] : []
	})
}

async function flattened(config: { plugins?: unknown } | null | undefined): Promise<unknown[]> {
	const flat = async (value: unknown): Promise<unknown[]> => {
		const resolved = await value
		if (Array.isArray(resolved)) return (await Promise.all(resolved.map(flat))).flat()
		return resolved ? [resolved] : []
	}
	return flat(config?.plugins)
}

/** Effect's `JSONSchema.make` for core's converters, when effect is installed; else undefined. */
export async function effectConverter(specifier = ["eff", "ect"].join("")): Promise<EffectConverter | undefined> {
	try {
		/* an opaque specifier: a literal one is folded into a Worker bundle, pulling the optional dependency in */
		const effect = (await import(specifier)) as { JSONSchema?: { make?: unknown } }
		const make = effect.JSONSchema?.make
		return typeof make === "function" ? (make as EffectConverter) : undefined
	} catch {
		/* effect is not installed: core then documents each Effect schema unconstrained and reports it */
		return undefined
	}
}
