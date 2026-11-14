/**
 * `invalidate` names operations by their declared operationId (D2): the document resolves each one to every
 * `"<METHOD> <pattern>"` selector its registration serves, so clients keep matching by method and path, and a target
 * that names no declared HTTP operation fails every build, whatever the invalidate level.
 */
import { describe, expect, it } from "vitest"
import { httpApp } from "../routing/app.ts"
import { SILENT } from "../telemetry/logger.ts"
import { ws } from "../ws/route.ts"
import { generateOpenApi } from "./generate.ts"
import { serveOpenApi } from "./serve.ts"

const INFO = { title: "T", version: "1" }
type App = ReturnType<typeof httpApp<{}>>

const invalidates = (doc: ReturnType<typeof generateOpenApi>, path: string, method: string) =>
	(doc.paths[path]?.[method] as Record<string, unknown> | undefined)?.["x-invalidate"]

/** The tables reads, and a mutation that invalidates `targets`. */
function tables(targets: readonly string[]): App {
	const app = httpApp<{}>()
	app
		.get("/v1/projects/:project_id/tables")
		.meta({ operationId: "table.list" })
		.handler((c) => c.res.text("ok", "ok"))
	app
		.get("/v1/projects/:project_id/tables/:table_id")
		.meta({ operationId: "table.retrieve" })
		.handler((c) => c.res.text("ok", "ok"))
	app
		.post("/v1/projects/:project_id/tables")
		.meta({ invalidate: targets, operationId: "table.create" })
		.handler((c) => c.res.text("ok", "ok"))
	return app
}

const UNKNOWN = (target: string | number) =>
	`UNKNOWN_INVALIDATE_TARGET: POST /v1/projects/:project_id/tables: invalidate target ${JSON.stringify(target)} names no HTTP operation`

describe("invalidate targets resolve to their selectors", () => {
	it("emits each declared id as the selectors its route serves, in the order declared", () => {
		const doc = generateOpenApi(tables(["table.list", "table.retrieve"]), { info: INFO })
		expect(invalidates(doc, "/v1/projects/{project_id}/tables", "post")).toEqual([
			"GET /v1/projects/:project_id/tables",
			"GET /v1/projects/:project_id/tables/:table_id",
		])
	})

	it("resolves a multi-method registration to each method, and an optional param to its one pattern", () => {
		const app = tables(["table.list"])
		app
			.on(["GET", "POST"], "/multi")
			.meta({ operationId: "multi" })
			.handler((c) => c.res.text("ok", "ok"))
		app
			.get("/opt/:id?")
			.meta({ operationId: "opt.retrieve" })
			.handler((c) => c.res.text("ok", "ok"))
		app
			.delete("/x")
			.meta({ invalidate: ["multi", "opt.retrieve"], operationId: "x.delete" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(invalidates(generateOpenApi(app, { info: INFO }), "/x", "delete")).toEqual([
			"GET /multi",
			"POST /multi",
			"GET /opt/:id?",
		])
	})

	it("resolves a target the document leaves out: an internal route, or one filterRoutes drops", () => {
		const app = tables(["table.list", "hidden.list"])
		app
			.get("/hidden")
			.meta({ internal: true, operationId: "hidden.list" })
			.handler((c) => c.res.text("ok", "ok"))
		const doc = generateOpenApi(app, {
			filterRoutes: (route) => route.path !== "/v1/projects/:project_id/tables" || route.method !== "GET",
			info: INFO,
		})
		expect([doc.paths["/hidden"], invalidates(doc, "/v1/projects/{project_id}/tables", "post")]).toEqual([
			undefined,
			["GET /v1/projects/:project_id/tables", "GET /hidden"],
		])
	})
})

describe("an invalidate target that names no HTTP operation", () => {
	it("fails the build at every invalidate level", () => {
		for (const invalidate of ["off", "warn", "error"] as const)
			expect(() => generateOpenApi(tables(["table.lst"]), { info: INFO, invalidate, logger: SILENT })).toThrow(
				UNKNOWN("table.lst"),
			)
	})

	it("refuses a WebSocket id, a path selector and a value no id can be, alike", () => {
		const app = tables(["rooms.connect", "GET /v1/projects/:project_id/tables", 42 as never])
		ws(app, "/rooms/:id")
			.meta({ operationId: "rooms.connect" })
			.handler({ onMessage() {} })
		const thrown = () => generateOpenApi(app, { info: INFO })
		expect(thrown).toThrow(UNKNOWN("rooms.connect"))
		expect(thrown).toThrow(UNKNOWN("GET /v1/projects/:project_id/tables"))
		expect(thrown).toThrow(UNKNOWN(42))
	})

	it("names a multi-method route's bad target once per method", () => {
		const app = tables([])
		app
			.on(["PUT", "PATCH"], "/both")
			.meta({ invalidate: ["nope"], operationId: "both.update" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(() => generateOpenApi(app, { info: INFO })).toThrow(
			/2 policy error\(s\):\n.*PUT \/both: invalidate target "nope".*\n.*PATCH \/both: invalidate target "nope"/,
		)
	})

	it("fails on a route the document leaves out, internal or filtered", () => {
		const app = tables([])
		app
			.post("/hidden")
			.meta({ internal: true, invalidate: ["gone"], operationId: "hidden.create" })
			.handler((c) => c.res.text("ok", "ok"))
		app
			.post("/dropped")
			.meta({ invalidate: ["gone"], operationId: "dropped.create" })
			.handler((c) => c.res.text("ok", "ok"))
		expect(() => generateOpenApi(app, { filterRoutes: (route) => route.path !== "/dropped", info: INFO })).toThrow(
			/2 policy error\(s\):\n.*POST \/hidden: invalidate target "gone".*\n.*POST \/dropped: invalidate target "gone"/,
		)
	})

	it("answers a served document 500", async () => {
		const app = tables(["table.lst"])
		serveOpenApi(app, { logger: SILENT, title: "T", version: "1" })
		const answer = await app.fetch(new Request("http://x/openapi.json"), {})
		expect(answer.status).toBe(500)
	})
})
