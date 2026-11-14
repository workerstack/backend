/**
 * httpApp()'s config (bit 19 h2): the route tree on by default and every other artifact off, `true` as each default
 * path, the OpenAPI outputs as a list with the security schemes declared once (plan 39 7.4), each output's formats
 * (JSON unless its path is YAML), the SDK and CLI keys refused as clients' (Q1), any key no option names
 * refused, and the outputs a watcher ignores.
 */
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
	generatedOutputs,
	type BackendPluginConfig,
	isGeneratedOutput,
	MCP_COMPANIONS,
	mcpPaths,
	openApiOutputPaths,
	resolveBackendConfig,
} from "./config.ts"

describe("resolveBackendConfig (bit 19 h2)", () => {
	// v0: a07a9c0bf4
	it("turns the route tree on by default and every other artifact off", () => {
		expect(resolveBackendConfig({ app: "src/app.ts" })).toEqual({
			app: "src/app.ts",
			codegen: {
				invalidate: undefined,
				manifest: false,
				mcp: false,
				mergeTree: undefined,
				openApi: [],
				tree: "src/_gen/routes.gen.ts",
				types: false,
			},
			watch: [],
		})
	})

	// v0: 757d938e2a
	it("reads true as each default path, a string as the path, and false as off", () => {
		const on = resolveBackendConfig({ codegen: { manifest: true, tree: true, types: true } }).codegen
		const paths = resolveBackendConfig({
			codegen: { manifest: "gen/m.json", tree: "gen/r.ts", types: { baseCtxName: "Ctx", path: "gen/t.d.ts" } },
		}).codegen
		const off = resolveBackendConfig({ codegen: { manifest: false, tree: false, types: false } }).codegen
		expect([on.manifest, on.tree, on.types]).toEqual([
			"src/_gen/manifest.gen.json",
			"src/_gen/routes.gen.ts",
			{ baseCtxName: undefined, path: "src/_gen/types.gen.d.ts" },
		])
		expect([paths.manifest, paths.tree, paths.types]).toEqual([
			"gen/m.json",
			"gen/r.ts",
			{ baseCtxName: "Ctx", path: "gen/t.d.ts" },
		])
		expect([off.manifest, off.tree, off.types]).toEqual([false, false, false])
		expect(resolveBackendConfig({ codegen: { types: "gen/x.d.ts" } }).codegen.types).toEqual({
			baseCtxName: undefined,
			path: "gen/x.d.ts",
		})
		expect(resolveBackendConfig({ codegen: { types: {} } }).codegen.types).toEqual({
			baseCtxName: undefined,
			path: "src/_gen/types.gen.d.ts",
		})
	})
})

describe("resolveBackendConfig (bit 19 h2), continued (2)", () => {
	it("takes one OpenAPI output or several, each at its own path or the default, its options kept", () => {
		const filterRoutes = () => true
		const one = resolveBackendConfig({ codegen: { openApi: { title: "A", version: "1" } } }).codegen.openApi
		const many = resolveBackendConfig({
			codegen: {
				openApi: [
					{ title: "A", version: "1" },
					{ filterRoutes, path: "b.yaml", sanitize: { stripXExtensions: true }, title: "B", version: "2" },
				],
			},
		}).codegen.openApi
		expect(one).toEqual([{ formats: ["json"], path: "src/_gen/openapi.gen.json", title: "A", version: "1" }])
		expect(many).toEqual([
			{ formats: ["json"], path: "src/_gen/openapi.gen.json", title: "A", version: "1" },
			{
				filterRoutes,
				formats: ["yaml"],
				path: "b.yaml",
				sanitize: { stripXExtensions: true },
				title: "B",
				version: "2",
			},
		])
	})

	it("declares the security schemes once; an output shows the ones it lists, and a name it lists must be declared", () => {
		const securitySchemes = { apiKey: { in: "header", name: "x-key", type: "apiKey" } }
		const doc = { name: "public", security: ["apiKey"], title: "A", version: "1" }
		expect(resolveBackendConfig({ codegen: { openApi: doc, securitySchemes } }).codegen.securitySchemes).toBe(
			securitySchemes,
		)
		expect(() =>
			resolveBackendConfig({ codegen: { openApi: { ...doc, security: ["jwt"] }, securitySchemes } }),
		).toThrow('codegen.openApi "public": security names "jwt", which codegen.securitySchemes does not declare')
		expect(() =>
			resolveBackendConfig({ codegen: { openApi: [doc, { ...doc, path: "b.json" }], securitySchemes } }),
		).toThrow('codegen.openApi: two documents are named "public"')
		expect(() => resolveBackendConfig({ codegen: { openApi: { ...doc, formats: [] }, securitySchemes } })).toThrow(
			'codegen.openApi "public": formats is empty',
		)
	})

	it("refuses the SDK and CLI keys, which are clients' (Q1)", () => {
		for (const key of ["sdk", "cli"])
			expect(() => resolveBackendConfig({ codegen: { [key]: true } } as BackendPluginConfig)).toThrow(
				`codegen.${key} moved: the SDKs, the CLI and MCP are clients': clients generate --app`,
			)
	})
})

describe("resolveBackendConfig: a key no option names (plan 39 7.4)", () => {
	it("refuses a key no option names, at any depth, and names where a moved one went", () => {
		const doc = { name: "public", title: "A", version: "1" }
		const refused = (config: unknown) => {
			try {
				resolveBackendConfig(config as BackendPluginConfig)
			} catch (error) {
				return (error as Error).message
			}
			return null
		}
		expect([
			refused({ apps: "src/index.ts" }),
			refused({ codegen: { tre: true } }),
			refused({ codegen: { openApi: { ...doc, securitySchemes: {} } } }),
			refused({ codegen: { openApi: [doc, { ...doc, name: "b", sanitize: { stripSecuritySchemes: ["k"] } }] } }),
			refused({ codegen: { openApi: { ...doc, sanitize: { stripSecurityRequirements: ["jwt"] } } } }),
			refused({ codegen: { openApi: { ...doc, sanitize: { stripXExtension: true } } } }),
			refused({ codegen: { mcp: { paths: "a.ts" } } }),
			refused({ codegen: { mcp: { securitySchemes: {} } } }),
			refused({ codegen: { types: { name: "Ctx" } } }),
		]).toEqual([
			"apps is no option",
			"codegen.tre is no option",
			'codegen.openApi "public".securitySchemes moved: declare each scheme once in codegen.securitySchemes',
			'codegen.openApi "b".sanitize.stripSecuritySchemes moved: security lists the schemes the document shows',
			'codegen.openApi "public".sanitize.stripSecurityRequirements moved: security lists the schemes the document shows',
			'codegen.openApi "public".sanitize.stripXExtension is no option',
			"codegen.mcp.paths is no option",
			"codegen.mcp.securitySchemes moved: declare each scheme once in codegen.securitySchemes",
			"codegen.types.name is no option",
		])
	})
})

describe("openApiOutputPaths: each format the output asks for (plan 39 7.4)", () => {
	// v0: ae748154a5
	// v0: ad73c602a0
	// v0: b9beb5f0ab
	it("writes the path in its own format and each other format beside it, under the same stem", () => {
		const both = ["json", "yaml"] as const
		expect([
			...["src/_gen/openapi.gen.json", "docs/openapi", "openapi.yml"].map((path) => openApiOutputPaths(path, both)),
			openApiOutputPaths("src/_gen/openapi.gen.json", ["json"]),
			openApiOutputPaths("openapi.yaml", ["yaml"]),
		]).toEqual([
			{ json: "src/_gen/openapi.gen.json", yaml: "src/_gen/openapi.gen.yaml" },
			{ json: "docs/openapi", yaml: "docs/openapi.yaml" },
			{ json: "openapi.json", yaml: "openapi.yml" },
			{ json: "src/_gen/openapi.gen.json", yaml: null },
			{ json: null, yaml: "openapi.yaml" },
		])
	})
})

describe("generatedOutputs (bit 19 h2)", () => {
	it("lists every file a generation writes, absolute, and the directories they sit in", () => {
		const config = resolveBackendConfig({
			codegen: {
				manifest: "out/m.json",
				mcp: "gen/server.ts",
				openApi: [
					{ formats: ["json", "yaml"], title: "A", version: "1" },
					{ path: "docs/b.yml", title: "B", version: "1" },
					{ name: "c", path: "docs/c.json", title: "C", version: "1" },
				],
				types: true,
			},
		})
		const outputs = generatedOutputs(config, "/p")
		expect(outputs).toEqual({
			dirs: ["/p/src/_gen", "/p/out", "/p/gen", "/p/gen/server", "/p/docs"],
			files: [
				"/p/src/_gen/routes.gen.ts",
				"/p/src/_gen/types.gen.d.ts",
				"/p/out/m.json",
				"/p/gen/server.ts",
				...MCP_COMPANIONS.map((name) => `/p/gen/server/${name}`),
				"/p/src/_gen/openapi.gen.json",
				"/p/src/_gen/openapi.gen.yaml",
				"/p/docs/b.yml",
				"/p/docs/c.json",
				"/p/src/_gen/openapi-sources.gen.ts",
			],
		})
		expect(
			[join("/p", "out/m.json"), "/p/out/m.json.x", "/p/src/app.ts"].map((file) => isGeneratedOutput(file, outputs)),
		).toEqual([true, false, false])
	})
})

describe("resolveBackendConfig's MCP handler (bit 21 e)", () => {
	it("reads true as src/_gen/mcp.gen.ts, a string as the path, an object with its options; its stem the directory", () => {
		const filterRoutes = () => true
		const outputs = [true, "gen/tools.ts", { filterRoutes, name: "shop", path: "gen/x.gen.ts" }, {}, false].map(
			(mcp) => resolveBackendConfig({ codegen: { mcp } }).codegen.mcp,
		)
		expect(outputs).toEqual([
			{ dir: "mcp", path: "src/_gen/mcp.gen.ts" },
			{ dir: "tools", path: "gen/tools.ts" },
			{ dir: "x", filterRoutes, name: "shop", path: "gen/x.gen.ts" },
			{ dir: "mcp", path: "src/_gen/mcp.gen.ts" },
			false,
		])
	})

	it("refuses an MCP output path that is no .ts module, and lists no file when the output is off", () => {
		expect(() => resolveBackendConfig({ codegen: { mcp: "gen/mcp.js" } })).toThrow(
			'codegen.mcp: "gen/mcp.js" is no .ts module',
		)
		expect(mcpPaths(false)).toEqual([])
	})
})
