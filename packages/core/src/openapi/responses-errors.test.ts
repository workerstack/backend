/**
 * The error responses a route's document carries, the second co-located test for responses.ts (split at the 500-line
 * cap): where a key's status comes from, only what a route declares, the keys left out, and the framework keys.
 */
import { describe, expect, it } from "vitest"
import * as z from "zod"
import { defineErrors } from "../errors/errors.ts"
import { createMiddleware } from "../middleware/middleware.ts"
import { httpApp } from "../routing/app.ts"
import { gatewayTree, overlaySchemas } from "../routing/gateway-tree.ts"
import { createNode, insertRoute, type RouteTree } from "../routing/tree.ts"
import { mergeTree } from "../routing/tree-merge.ts"
import { generateOpenApi } from "./generate.ts"

const INFO = { title: "T", version: "1" }
type Doc = ReturnType<typeof generateOpenApi>
type Response = {
	content?: Record<string, { schema?: unknown }>
	description: string
	headers?: Record<string, unknown>
}

const responses = (doc: Doc, path: string, method: string | undefined = "get") =>
	(doc.paths[path]?.[method]?.responses ?? {}) as Record<string, Response>

/** `schema` with a component reference followed. */
function resolved(doc: Doc, schema: unknown): Record<string, unknown> {
	const ref = (schema as { $ref?: string } | undefined)?.$ref
	if (ref === undefined) return (schema ?? {}) as Record<string, unknown>
	return doc.components?.schemas?.[ref.split("/").pop() as string] ?? {}
}

/** The error body schema of `status`, under `media`. */
const errorSchema = (doc: Doc, path: string, status: string, at: { media?: string; method?: string } = {}) =>
	resolved(doc, responses(doc, path, at.method)[status]?.content?.[at.media ?? "application/json"]?.schema)

const keysOf = (schema: Record<string, unknown>) =>
	(schema.properties as { error_key?: { enum?: string[] } } | undefined)?.error_key?.enum

/** A gateway's or a worker's errors: the shared keys and `extra`. */
const errorsOf = <const TExtra extends Record<string, "bad_request" | "conflict">>(extra: TExtra) =>
	defineErrors({ internal_server_error: "internal_server_error", optimistic_lock_conflict: "conflict", ...extra })

describe("errors: where a key's status comes from", () => {
	// v0: 5e035db0c2
	// v0: fd7332a3e0

	it("takes a loaded leaf's status from the factory of the app it came from, then the key's status suffix", () => {
		const worker = httpApp<{}>()
			.errorFactory(defineErrors({ item_not_found: "not_found", not_found: "not_found" }))
			.defaultErrors("not_found")
		worker
			.get("/items/:id")
			.meta({ operationId: "items.retrieve" })
			.errors("item_not_found")
			.handler((c) => c.res.json("ok", {}))
		const gateway = httpApp<{}>()
			.errorFactory(defineErrors({ not_found: "not_found" }))
			.routeTree(worker.toRouteTree())
		const root = createNode()
		const id = insertRoute(root, "GET", "/events/:id")
		const loose = httpApp<{}>().routeTree({
			meta: {},
			root,
			routes: { [id]: { ek: ["billing_event_not_found"], mt: { operationId: "events.retrieve" } } },
			v: 2,
		})
		const doc = generateOpenApi(gateway, { info: INFO })
		expect([
			keysOf(errorSchema(doc, "/items/{id}", "404")),
			Object.keys(responses(generateOpenApi(loose, { info: INFO }), "/events/{id}")),
		]).toEqual([["item_not_found", "not_found"], ["404"]])
	})

	// v0: 41d060c00f
	it("documents a delegated route's own keys under its own app's statuses, beside the gateway's default keys", () => {
		const down = httpApp<{}>()
			.errorFactory(errorsOf({ column_name_taken: "conflict" }))
			.defaultBoundary("internal_server_error")
		down
			.post("/columns")
			.meta({ operationId: "columns.create" })
			.errors("column_name_taken", "optimistic_lock_conflict")
			.handler((c) => c.res.json("ok", {}))
		const source = mergeTree([down.toRouteTree(), { worker: "down" }])
		const gateway = (tree?: RouteTree) => {
			const app = httpApp<{}>()
				.errorFactory(errorsOf({ captcha_failed: "bad_request" }))
				.defaultBoundary("internal_server_error")
				.defaultErrors("captcha_failed")
			app.all("/*").handler((c) => c.res.json("ok", {}))
			return tree === undefined ? app : app.routeTree(tree)
		}
		const app = gateway(gatewayTree(gateway(), source))
		overlaySchemas(app, source)
		const doc = generateOpenApi(app, { info: INFO })
		expect([
			keysOf(errorSchema(doc, "/columns", "409", { method: "post" })),
			keysOf(errorSchema(doc, "/columns", "400", { method: "post" })),
		]).toEqual([["column_name_taken", "optimistic_lock_conflict"], ["captcha_failed"]])
	})
})

describe("errors: what a route declares, and nothing more", () => {
	it("documents a scoped middleware's keys on the routes it covers only", () => {
		const errors = defineErrors({ blocked: "forbidden" })
		const block = createMiddleware(async (_c, next) => next(), { errors: [errors, "blocked"] })
		const app = httpApp<{}>().errorFactory(errors)
		app.use("/admin", block)
		app
			.get("/admin/x")
			.meta({ operationId: "admin.x.list" })
			.handler((c) => c.res.json("ok", {}))
		app
			.get("/public")
			.meta({ operationId: "public.list" })
			.handler((c) => c.res.json("ok", {}))
		const doc = generateOpenApi(app, { info: INFO })
		expect([Object.keys(responses(doc, "/admin/x")), Object.keys(responses(doc, "/public"))]).toEqual([
			["403"],
			["200"],
		])
	})
})

describe("errors a route does not get documented", () => {
	it("leaves out a key with no status anywhere, and a status the route answers itself", () => {
		const root = createNode()
		const id = insertRoute(root, "GET", "/odd")
		const loose = httpApp<{}>().routeTree({
			meta: {},
			root,
			routes: { [id]: { ek: ["mystery"], mt: { operationId: "odd.get" } } },
			v: 2,
		})
		/* an error key may carry any status; at one the route's output declares, the output's answer is documented */
		const app = httpApp<{}>().errorFactory(defineErrors({ still_queued: "accepted" }))
		app
			.post("/users")
			.meta({ operationId: "users.create" })
			.errors("still_queued")
			.output({ "application/json": { accepted: z.object({ existing: z.string() }) } })
			.handler((c) => c.res.json("accepted", { existing: "1" }))
		expect([
			responses(generateOpenApi(loose, { info: INFO }), "/odd"),
			responses(generateOpenApi(app, { info: INFO }), "/users", "post")["202"]?.description,
		]).toEqual([{ "200": { description: "Success" } }, "accepted"])
	})
})

describe("framework keys: declared on a route without the app re-declaring them", () => {
	it("documents a declared framework key under backend's status, in the route's enum", () => {
		const app = httpApp<{}>().errorFactory(defineErrors({ org_limit_reached: "forbidden" }))
		app
			.post("/orgs")
			.meta({ operationId: "orgs.create" })
			.errors("validation_failed", "org_limit_reached")
			.input({ json: z.object({ name: z.string() }) })
			.handler((c) => c.res.text("ok", "x"))
		const doc = generateOpenApi(app, { info: INFO })
		expect([
			Object.keys(responses(doc, "/orgs", "post")),
			keysOf(errorSchema(doc, "/orgs", "400", { method: "post" })),
		]).toEqual([["400", "403"], ["validation_failed"]])
	})
})
