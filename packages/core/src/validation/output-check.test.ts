/**
 * The answer check `#output-check` resolves to by default, on its own: what it lets through unread, and that a
 * route's check runs its declared headers before its body. Its run through an app is validate-output.test.ts's.
 */
import { describe, expect, it, vi } from "vitest"
import * as vb from "valibot"
import * as z from "zod"
import { HoneyRes } from "../response/response.ts"
import { honey } from "../routing/app.ts"
import { createNode, insertRoute } from "../routing/tree.ts"
import type { StandardSchemaLike } from "./standard-schema.ts"
import { compileOutput, outputCheck } from "./output-check.ts"

/** A schema that answers `issues` (none: the value), synchronously. */
function schemaOf(issues: { message: string }[] = []): StandardSchemaLike {
	return {
		"~standard": { validate: (value) => (issues.length > 0 ? { issues } : { value }), vendor: "test", version: 1 },
	}
}

describe("compileOutput: answers it lets through unread", () => {
	const failing = { "application/json": { ok: schemaOf([{ message: "always fails" }]) } }

	it("a body with no content type, and a status no status key names, pass unread", () => {
		const check = compileOutput(failing, null)
		const untyped = new Response(new Blob(["{}"]).stream())
		const unnamed = new Response("{}", { headers: { "content-type": "application/json" }, status: 299 })
		expect([check(untyped, {}), check(unnamed, {})]).toEqual([untyped, unnamed])
	})

	it("passes a forwarded answer unread, whatever its media type: forwardCheck judges it", () => {
		const forwarded = new HoneyRes().forward(
			new Response("<p>", { headers: { "content-type": "text/html" }, status: 404 }),
		)
		expect(compileOutput(failing, null)(forwarded, {})).toBe(forwarded)
	})

	it("checks the declared headers first: an async header check makes the answer a promise", async () => {
		const later = vi.fn(async () => undefined)
		const check = compileOutput({ "application/json": { ok: schemaOf() } }, later)
		const response = new HoneyRes().json("ok", {})
		const answered = check(response, {})
		expect([answered instanceof Promise, await answered, later.mock.calls]).toEqual([true, response, [[response]]])
	})
})

describe("outputCheck: a route's whole check, its declared headers compiled in", () => {
	it("refuses an answer missing a declared header, and passes one that carries it", async () => {
		const check = outputCheck({
			"application/json": { ok: z.object({}) },
			headers: { ok: z.object({ etag: z.string() }) },
		})
		const refused = await Promise.resolve()
			.then(() => check?.(new HoneyRes().json("ok", {}), {}))
			.catch((error: unknown) => (error as { errorKey: string }).errorKey)
		const tagged = new HoneyRes().json("ok", {}, { headers: { etag: '"v1"' } as never })
		expect([refused, check?.(tagged, {})]).toEqual(["output_validation_failed", tagged])
	})
})

const row = z.object({ id: z.string(), name: z.string(), slug: z.string() })
const page = z.object({ items: z.array(row), next: z.string().nullable() })
const search = z.object({ select: z.string().optional() })
/* what `?select=a,b` names, the rows sitting under `items` */
const projection = (ctx: { input: { search: { select?: string | undefined } } }) =>
	ctx.input.search.select === undefined
		? null
		: { at: "items", select: { relations: {}, scalars: ctx.input.search.select.split(",") } }
const cutRow = { items: [{ id: "a" }], next: null }
const ok = [200, JSON.stringify(cutRow)]
const appOf = () => honey<{}>().logger(false)

/** A route at `path` answering `body` under `schema`, projected by `?select`. */
function listing(
	app: ReturnType<typeof appOf>,
	path: string,
	body: unknown = cutRow,
	schema: StandardSchemaLike = page,
) {
	app
		.get(path)
		.input({ search })
		.output({ ok: schema as typeof page }, { projection })
		.handler((ctx) => ctx.res.json("ok", body as never))
}

async function answer(app: { fetch: (r: Request, env: {}) => Response | Promise<Response> }, path: string) {
	const res = await app.fetch(new Request(`http://x${path}`), {})
	return [res.status, await res.text()]
}

describe("a route's projection: an answer cut to the fields its request selects", () => {
	it("passes a row cut to the selection, and refuses a selected field of the wrong type", async () => {
		const app = appOf()
		listing(app, "/cut")
		listing(app, "/wrong", { items: [{ id: 1 }], next: null })
		listing(app, "/envelope", { items: [{ id: "a" }] })
		expect([
			await answer(app, "/cut?select=id"),
			(await answer(app, "/wrong?select=id"))[0],
			(await answer(app, "/envelope?select=id"))[0],
			(await answer(app, "/cut?select=id,name"))[0],
		]).toEqual([ok, 500, 500, 500])
	})

	it("checks the answer whole when the projection is null, and a route without one as before", async () => {
		const app = appOf()
		listing(app, "/p")
		app
			.get("/plain")
			.output({ ok: page })
			.handler((ctx) => ctx.res.json("ok", cutRow as never))
		expect([(await answer(app, "/p"))[0], (await answer(app, "/plain?select=id"))[0]]).toEqual([500, 500])
	})
})

describe("a route's projection, across validators", () => {
	it("holds for a valibot schema", async () => {
		const app = appOf()
		const vRow = vb.object({ id: vb.string(), name: vb.string() })
		listing(app, "/v", cutRow, vb.object({ items: vb.array(vRow), next: vb.nullable(vb.string()) }))
		expect([await answer(app, "/v?select=id"), (await answer(app, "/v"))[0]]).toEqual([ok, 500])
	})

	it("holds for an async validator", async () => {
		const app = appOf()
		listing(
			app,
			"/a",
			cutRow,
			page.refine(async () => true),
		)
		expect([await answer(app, "/a?select=id"), (await answer(app, "/a"))[0]]).toEqual([ok, 500])
	})
})

describe("a route's projection, across the ways an answer is served", () => {
	it("holds behind a declared header check, and for a body honey did not build", async () => {
		const app = appOf()
		app
			.get("/h")
			.input({ search })
			.output({ headers: { ok: z.object({ etag: z.string() }) }, ok: page }, { projection })
			.handler((ctx) => ctx.res.json("ok", cutRow as never, { headers: { etag: '"1"' } as never }))
		app
			.get("/foreign")
			.input({ search })
			.output({ ok: page }, { projection })
			.handler(
				(ctx) =>
					(ctx.res as unknown as HoneyRes).raw(
						new Response(JSON.stringify(cutRow), { headers: { "content-type": "application/json" } }),
					) as never,
			)
		expect([await answer(app, "/h?select=id"), await answer(app, "/foreign?select=id")]).toEqual([ok, ok])
	})

	it("holds for a route replayed onto a loaded route tree", async () => {
		const app = appOf()
		listing(app, "/orgs")
		const root = createNode()
		const id = insertRoute(root, "GET", "/orgs")
		const served = app.routeTree({ meta: {}, root, routes: { [id]: {} }, v: 2 })
		expect(await answer(served, "/orgs?select=id")).toEqual(ok)
	})
})
