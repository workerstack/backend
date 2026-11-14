import { describe, expect, it } from "vitest"
import plugin from "./boundaries.js"
import { oxlintReports, reportsOf } from "./rule-harness.ts"
import { SPAWN_TIMEOUT } from "../tests/fixture/spawn-timeout.ts"

const rule = plugin.rules.boundaries
const NODE = "node builtins are for build-time code only"
const ADAPTER = "only the Workers adapter may import the Workers adapter"
const ESCAPE = "an import stays inside its package's src (no repo path outside it, no sibling package)"
const TS_MORPH = "ts-morph is clients' dependency, not core's"
const CLIENTS = "core reaches clients from build/ only"
const CLIENTS_STATIC = "core imports clients through import() only: it is an optional peer"
const global = (name: string) => `${name} is not available here (00-rules environments)`

describe("backend/boundaries: imports", () => {
	it("keeps node builtins in build-time code", () => {
		const fixture = {
			"packages/core/src/routing/app.ts": 'import { readFileSync } from "node:fs"\nimport path from "path"\n',
			"packages/core/src/ws/workers.ts": 'import { STATUS_CODES } from "node:http"\n',
			"packages/core/src/build/plugin.ts": 'import { readFileSync } from "node:fs"\n',
		}
		expect(reportsOf(rule, fixture)).toEqual([
			{ file: "packages/core/src/routing/app.ts", message: NODE },
			{ file: "packages/core/src/routing/app.ts", message: NODE },
			{ file: "packages/core/src/ws/workers.ts", message: NODE },
		])
	})

	it("lets only the Workers adapter import the Workers adapter, statically or dynamically", () => {
		const fixture = {
			"packages/core/src/routing/dispatch.ts": 'import { workersWebSocket } from "../ws/workers.ts"\n',
			"packages/core/src/context/peer.ts": 'export const load = () => import("../ws/workers.ts")\n',
			"packages/core/src/response/sse.ts": 'export { workersWebSocket } from "../ws/workers.ts"\n',
			"packages/core/src/ws/route.ts": 'import { WSContextImpl } from "./contract.ts"\n',
			"packages/core/src/ws/ws-subpath.ts": 'export { workersWebSocket } from "./workers.ts"\n',
			"packages/core/src/adapters/workers/serve.ts": 'import { workersWebSocket } from "../../ws/workers.ts"\n',
		}
		expect(reportsOf(rule, fixture)).toEqual([
			{ file: "packages/core/src/routing/dispatch.ts", message: ADAPTER },
			{ file: "packages/core/src/context/peer.ts", message: ADAPTER },
			{ file: "packages/core/src/response/sse.ts", message: ADAPTER },
		])
	})

	it("never leaves the package's src: no repo path outside it, no sibling package by path", () => {
		const fixture = {
			"packages/core/src/routing/app.ts": 'import { judge } from "../../../../bench/src/significance.ts"\n',
			"packages/core/src/errors/error.ts": 'export * from "../../../clients/src/ir/model.ts"\n',
			"packages/core/src/routing/match.ts":
				'import { tree } from "./tree.ts"\nimport { e } from "../errors/error.ts"\n',
		}
		expect(reportsOf(rule, fixture)).toEqual([
			{ file: "packages/core/src/routing/app.ts", message: ESCAPE },
			{ file: "packages/core/src/errors/error.ts", message: ESCAPE },
		])
	})
})

describe("backend/boundaries: packages", () => {
	it("pins clients to build/, and keeps ts-morph out of core", () => {
		const fixture = {
			"packages/core/src/build/types.ts": 'import { Project } from "ts-morph"\n',
			"packages/core/src/openapi/document.ts": 'import { generate } from "@workerstack/clients"\n',
			"packages/core/src/build/plugin.ts": 'import { generateTypes } from "@workerstack/clients"\n',
			"packages/core/src/build/generate.ts": [
				'import type { RouteTree } from "@workerstack/clients"',
				'export type { RouteTree } from "@workerstack/clients"',
				'export { generateTypes } from "@workerstack/clients"',
				'export const codegen = () => import("@workerstack/clients")',
				"",
			].join("\n"),
		}
		expect(reportsOf(rule, fixture)).toEqual([
			{ file: "packages/core/src/build/types.ts", message: TS_MORPH },
			{ file: "packages/core/src/openapi/document.ts", message: CLIENTS },
			/* bit 19 h2 (Q2): an optional peer, so build/ reaches it on demand, never as the module loads */
			{ file: "packages/core/src/build/plugin.ts", message: CLIENTS_STATIC },
			{ file: "packages/core/src/build/generate.ts", message: CLIENTS_STATIC },
		])
	})
})

describe("backend/boundaries: runtime globals", () => {
	it("keeps Node globals in build-time code and WebSocketPair in the Workers adapter", () => {
		const fixture = {
			"packages/core/src/routing/app.ts": [
				"export const a = process.env.X",
				"export const b = Buffer.from('x')",
				"export const c = typeof Bun",
				"export const e = new WebSocketPair()",
				"export const f = window.location",
				"export const g = document.title",
				"",
			].join("\n"),
			"packages/core/src/build/plugin.ts": "export const a = process.env.PORT\nexport const b = Buffer.alloc(1)\n",
			"packages/core/src/ws/workers.ts": "export const p = new WebSocketPair()\n",
			"packages/core/src/build/cli.ts": "export const argv = process.argv\n",
			"packages/core/src/routing/match.ts": "const o = { process: 1, Bun: 2 }\nexport const n = o.process + o.Bun\n",
		}
		expect(reportsOf(rule, fixture)).toEqual([
			{ file: "packages/core/src/routing/app.ts", message: global("process") },
			{ file: "packages/core/src/routing/app.ts", message: global("Buffer") },
			{ file: "packages/core/src/routing/app.ts", message: global("Bun") },
			{ file: "packages/core/src/routing/app.ts", message: global("WebSocketPair") },
			{ file: "packages/core/src/routing/app.ts", message: global("window") },
			{ file: "packages/core/src/routing/app.ts", message: global("document") },
		])
	})

	it("ignores tests and files outside the packages' src", () => {
		const fixture = {
			"packages/core/src/routing/app.test.ts": 'import { readFileSync } from "node:fs"\nexport const a = process.env\n',
			"packages/core/tests/integration/routing.test.ts": 'import { x } from "../../../../bench/src/significance.ts"\n',
			"bench/src/hotpath.ts": 'import { readFileSync } from "node:fs"\n',
		}
		expect(reportsOf(rule, fixture)).toEqual([])
	})

	it("fails oxlint through the backend plugin entry", { timeout: SPAWN_TIMEOUT }, () => {
		const fixture = {
			"packages/core/src/routing/app.ts": 'import { readFileSync } from "node:fs"\n',
			"packages/core/src/build/plugin.ts": 'import { readFileSync } from "node:fs"\n',
		}
		expect(oxlintReports("boundaries", fixture)).toEqual([{ file: "packages/core/src/routing/app.ts", message: NODE }])
	})
})
