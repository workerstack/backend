/**
 * Apps run on Cloudflare Workers only (D16): no Node or Bun server, no `ws` peer, and the build plugin refuses every
 * target but `workers`.
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createBuildPlugin } from "../../src/build/targets.ts"

const CORE = join(import.meta.dirname, "../..")
const manifest = JSON.parse(readFileSync(join(CORE, "package.json"), "utf8")) as {
	readonly exports: Readonly<Record<string, unknown>>
	readonly peerDependencies?: Readonly<Record<string, string>>
	readonly peerDependenciesMeta?: Readonly<Record<string, unknown>>
	readonly devDependencies?: Readonly<Record<string, string>>
}

const RUNTIME_SUBPATHS = ["./node", "./bun", "./ws/node", "./ws/bun", "./ws/session", "./queue/serve", "./cron/serve"]
const RUNTIME_SOURCES = [
	"src/adapters/node",
	"src/adapters/bun",
	"src/ws/node.ts",
	"src/ws/bun.ts",
	"src/queue/serve.ts",
	"src/cron/serve.ts",
	"src/runtime/detect-runtime.ts",
]
const APP = { entry: "./src/app.ts", export: "default" }

describe("workers only", () => {
	it("exports no Node or Bun runtime subpath", () => {
		expect(RUNTIME_SUBPATHS.filter((path) => Object.hasOwn(manifest.exports, path))).toEqual([])
	})

	it("declares no ws dependency", () => {
		const declared = [manifest.peerDependencies, manifest.peerDependenciesMeta, manifest.devDependencies]
		expect(declared.filter((deps) => deps !== undefined && Object.hasOwn(deps, "ws"))).toEqual([])
	})

	it("has no Node or Bun runtime source", () => {
		expect(RUNTIME_SOURCES.filter((path) => existsSync(join(CORE, path)))).toEqual([])
	})

	it("builds the workers target and refuses node and bun", () => {
		expect(createBuildPlugin({ target: "workers" }, APP).apply).toBe("build")
		for (const target of ["node", "bun"])
			expect(() => createBuildPlugin({ target } as never, APP)).toThrow(`unknown target "${target}"; expected workers`)
	})
})
