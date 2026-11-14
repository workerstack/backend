/**
 * Every documented route declares an operationId (D18): the document build names each one that does not, once per
 * method and pattern. A route the document leaves out needs none, and the check reads the id the route declares, so a
 * profile that strips ids still builds and an id only a metaSpec entry writes does not count.
 */
import { describe, expect, it } from "vitest"
import { httpApp } from "../routing/app.ts"
import { ws } from "../ws/route.ts"
import { generateOpenApi } from "./generate.ts"

const INFO = { title: "T", version: "1" }
const missing = (pattern: string) =>
	`${pattern} declares no operationId; every route needs one for OperationCtx and invalidate`

/** The MISSING_OPERATION_ID lines `generateOpenApi(app)` throws, or `[]` when it builds. */
function missingIds(app: Parameters<typeof generateOpenApi>[0], options: { profile?: string } = {}): string[] {
	try {
		generateOpenApi(app, { info: INFO, ...options })
		return []
	} catch (error) {
		return String((error as Error).message)
			.split("\n")
			.filter((line) => line.includes("MISSING_OPERATION_ID"))
			.map((line) => line.replace(/^\s*- MISSING_OPERATION_ID: route /, ""))
	}
}

describe("generateOpenApi: every documented route declares an operationId", () => {
	it("names each route that declares none, by method and pattern", () => {
		const app = httpApp<{}>()
		app.get("/v1/health").handler((c) => c.res.text("ok", "ok"))
		app.post("/v1/items").handler((c) => c.res.text("ok", "ok"))
		app
			.get("/v1/items/:id")
			.meta({ operationId: "items.retrieve" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(missingIds(app)).toEqual([missing("GET /v1/health"), missing("POST /v1/items")])
	})

	it("names a WebSocket route as WS", () => {
		const app = httpApp<{}>()
		ws(app, "/live").handler({ onMessage: () => {} })
		expect(missingIds(app)).toEqual([missing("WS /live")])
	})

	it("names each method of a multi-method registration once, and an optional-param route once", () => {
		const app = httpApp<{}>()
		app.on(["GET", "POST"], "/multi").handler((c) => c.res.text("ok", "ok"))
		app.get("/items/:id?").handler((c) => c.res.text("ok", "ok"))
		expect(missingIds(app)).toEqual([missing("GET /multi"), missing("POST /multi"), missing("GET /items/:id?")])
	})

	it("needs no id on a route the document leaves out", () => {
		const app = httpApp<{}>()
		app
			.get("/hidden")
			.meta({ internal: true })
			.handler((c) => c.res.text("ok", "ok"))
		app.get("/dropped").handler((c) => c.res.text("ok", "ok"))
		app
			.get("/kept")
			.meta({ operationId: "kept.get" })
			.handler((c) => c.res.text("ok", "ok"))
		const doc = generateOpenApi(app, { filterRoutes: ({ path }) => path !== "/dropped", info: INFO })
		expect([Object.keys(doc.paths), doc.paths["/kept"]?.get?.operationId]).toEqual([["/kept"], "kept.get"])
	})

	it("builds a profile that strips the ids, since the routes declare them", () => {
		const app = httpApp<{}>()
		app.metaSpec({ meta: {}, profiles: { public: { exclude: ["operationId"] } } })
		app
			.get("/a")
			.meta({ operationId: "a.get" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(missingIds(app, { profile: "public" })).toEqual([])
	})

	it("does not count an id only a metaSpec entry writes", () => {
		const app = httpApp<{}>().metaType<{ name?: string }>()
		app.metaSpec({ meta: { name: { key: "operationId" } } })
		app
			.get("/a")
			.meta({ name: "a.get" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(missingIds(app)).toEqual([missing("GET /a")])
	})
})
