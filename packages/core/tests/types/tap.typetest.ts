/**
 * Tap typing: `defineTap(name, schema, handler)` types the handler's payload by the schema's output and `c.tap(tap,
 * payload)` by its input; `app.tap(tap)` registers it and returns the handle; a meta-fired tap's key joins the app's
 * meta type through `TapMeta<typeof tap>`. The string-keyed forms are gone. Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import * as z from "zod"
import { defineErrors } from "../../src/errors/errors.ts"
import { createMiddleware } from "../../src/middleware/middleware.ts"
import { httpApp } from "../../src/routing/app.ts"
import { defineTap, type TapDefinition, type TapContext, type TapMeta } from "../../src/routing/define-tap.ts"

const audit = defineTap("audit", z.object({ action: z.string(), actor_id: z.string() }), () => {})
const webhook = defineTap("webhook", z.object({ event: z.string() }), () => {})
/* input and output differ: a string in, a number out */
const counted = defineTap("counted", z.object({ n: z.string().transform(Number) }), (_ctx, payload) => {
	expectTypeOf(payload).toEqualTypeOf<{ n: number }>()
})

describe("c.tap(tap, payload): the payload is the schema's input", () => {
	// v0: 0f942cb812
	// v0: e52161eadf
	it("takes the tap's exact input; another shape, a missing or extra field, or a string key is an error", () => {
		httpApp<{}>()
			.tap(audit)
			.tap(webhook)
			.get("/t")
			.handler((c) => {
				expectTypeOf<Parameters<typeof c.tap<typeof audit>>[1]>().toEqualTypeOf<{
					action: string
					actor_id: string
				}>()
				expectTypeOf<Parameters<typeof c.tap<typeof counted>>[1]>().toEqualTypeOf<{ n: string }>()
				c.tap(audit, { action: "create", actor_id: "usr_1" })
				c.tap(webhook, { event: "created" })
				c.tap(counted, { n: "3" })
				// @ts-expect-error the wrong shape
				c.tap(audit, { wrong: true })
				// @ts-expect-error a required field missing
				c.tap(audit, { action: "create" })
				// @ts-expect-error another tap's shape
				c.tap(webhook, { action: "nope" })
				// @ts-expect-error an extra field
				c.tap(audit, { action: "create", actor_id: "usr_1", extra: true })
				// @ts-expect-error the schema's output is not its input
				c.tap(counted, { n: 3 })
				// @ts-expect-error a string key is gone
				c.tap("audit", { action: "create", actor_id: "usr_1" })
				return c.res.json("ok", {})
			})
	})

	// v0: bc13d010d8
	it("returns nothing", () => {
		httpApp<{}>()
			.get("/t")
			.handler((c) => {
				expectTypeOf(c.tap(webhook, { event: "e" })).toBeVoid()
				return c.res.json("ok", {})
			})
	})
})

describe("defineTap and app.tap(tap)", () => {
	// v0: 9c2d380a3c
	it("the handler's payload is the schema's output, and the tap keeps its name and schema", () => {
		const schema = z.object({ event: z.string() })
		const tap = defineTap("hook", schema, (_ctx, payload) => {
			expectTypeOf(payload).toEqualTypeOf<{ event: string }>()
		})
		expectTypeOf(tap).toEqualTypeOf<TapDefinition<"hook", typeof schema, unknown>>()
		expectTypeOf(tap.name).toEqualTypeOf<"hook">()
	})

	// v0: ac27224138
	// v0: b5c3db911c
	it("a handler typed by the env gets a TapContext over it: the request, no res and no tap", () => {
		type Env = { DB_URL: string; SECRET: string }
		const secretTap = defineTap("secret", z.object({ id: z.string() }), (ctx: TapContext<Env>) => {
			expectTypeOf(ctx.env.SECRET).toEqualTypeOf<string>()
			expectTypeOf(ctx.params).toEqualTypeOf<Record<string, string>>()
			expectTypeOf(ctx.headers).toEqualTypeOf<Record<string, string>>()
			expectTypeOf(ctx.meta).toEqualTypeOf<Record<string, unknown>>()
			expectTypeOf(ctx.search).toEqualTypeOf<Record<string, string>>()
			expectTypeOf(ctx.req).toEqualTypeOf<Request>()
			expectTypeOf(ctx.background).toBeFunction()
			expectTypeOf(ctx).not.toHaveProperty("res")
			expectTypeOf(ctx).not.toHaveProperty("tap")
		})
		httpApp<Env>().tap(secretTap)
	})

	// v0: 9f5d7cad5f
	// v0: d63932cc79
	it("a handler may return nothing or a promise, and app.tap() returns the handle", () => {
		const later = defineTap("later", z.object({}), async () => {})
		const app = httpApp<{}>()
		const chained = app.tap(audit).tap(later)
		expectTypeOf(chained).toEqualTypeOf(app)
	})

	it("a tap typed by its schema and env is a TapDefinition: it goes in a map and to c.tap and app.tap", () => {
		type Env = { SECRET: string }
		const typed = defineTap("typed", z.object({ id: z.string() }), (ctx: TapContext<Env>, payload) => {
			void ctx.env.SECRET
			void payload.id
		})
		const map: ReadonlyMap<string, TapDefinition> = new Map([[typed.name, typed]])
		expectTypeOf(map).toEqualTypeOf<ReadonlyMap<string, TapDefinition>>()
		httpApp<Env>()
			.tap(typed)
			.get("/t")
			.handler((c) => {
				c.tap(typed, { id: "1" })
				return c.res.json("ok", {})
			})
	})
})

describe("the string-keyed forms", () => {
	it("are gone", () => {
		const app = httpApp<{}>()
		expectTypeOf(app.tap).parameter(0).not.toBeString()
		// @ts-expect-error a key and a handler is no longer a tap
		app.tap("audit", () => {})
		// @ts-expect-error .taps<T>() is gone
		app.taps<{ audit: { action: string } }>()
	})
})

describe("route meta: a meta-fired tap's key through TapMeta", () => {
	// v0: fe9637b053
	// v0: 0012d0d7c2
	it("TapMeta types the key by the schema's input, and it is optional", () => {
		const app = httpApp<{}>().metaType<TapMeta<typeof audit>>().tap(audit)
		app
			.get("/a")
			.meta({ audit: { action: "create", actor_id: "usr_1" } })
			.handler((c) => {
				expectTypeOf(c.meta.audit).toEqualTypeOf<{ action: string; actor_id: string }>()
				return c.res.json("ok", {})
			})
		app
			.get("/b")
			// @ts-expect-error the wrong shape for audit
			.meta({ audit: { wrong: true } })
			.handler((c) => c.res.json("ok", {}))
		app.get("/none").handler((c) => c.res.json("ok", {}))
	})

	// v0: c81529e274
	// v0: 9a356bf11d
	it("beside the app's own meta type, both reach the handler's meta", () => {
		type RouteMeta = { operationId: string; security: string }
		httpApp<{}>()
			.metaType<RouteMeta & TapMeta<typeof webhook>>()
			.tap(webhook)
			.get("/a")
			.meta({ operationId: "a", security: "jwt", webhook: { event: "test" } })
			.handler((c) => {
				expectTypeOf(c.meta.operationId).toEqualTypeOf<string>()
				expectTypeOf(c.meta.webhook).toEqualTypeOf<{ event: string }>()
				return c.res.json("ok", {})
			})
	})

	it("TapMeta maps the tap's name to its schema's input", () => {
		expectTypeOf<TapMeta<typeof counted>>().toEqualTypeOf<{ readonly counted?: { n: string } }>()
	})
})

describe("c.tap() through every handle", () => {
	// v0: 6d4061927d
	// v0: 6053b5e91c
	// v0: 0bb3f8b0bc
	// v0: 4b7706da43
	it("basePath, use, errorFactory and context all keep a typed c.tap", () => {
		const errors = defineErrors({ a: "bad_request", b: "not_found" })
		const app = httpApp<{}>().tap(audit)
		app
			.basePath("/api/v1")
			.get("/t")
			.handler((c) => {
				expectTypeOf(c.routePattern).toEqualTypeOf<"/api/v1/t">()
				// @ts-expect-error still typed after basePath
				c.tap(audit, {})
				return c.res.json("ok", {})
			})
		app
			.use(createMiddleware(async (_ctx, next) => next({ a: 1 })))
			.get("/u")
			.handler((c) => {
				expectTypeOf(c.a).toEqualTypeOf<number>()
				c.tap(audit, { action: "test", actor_id: "sys" })
				// @ts-expect-error still typed after use
				c.tap(audit, {})
				return c.res.json("ok", {})
			})
		app
			.errorFactory(errors)
			.defaultErrors("a")
			.get("/e")
			.errors("b")
			.handler((c) => {
				expectTypeOf(c.errors.b).toBeFunction()
				// @ts-expect-error still typed after errorFactory
				c.tap(audit, {})
				return c.res.json("ok", {})
			})
		app
			.context({ db: { query: () => [] as unknown[] } })
			.get("/c")
			.handler((c) => {
				expectTypeOf(c.db.query).toBeFunction()
				// @ts-expect-error still typed after context
				c.tap(audit, {})
				return c.res.json("ok", {})
			})
	})
})

describe("c.tap() across a mount", () => {
	// v0: f0e7d816a5
	it("a parent that mounted a sub keeps a typed c.tap", () => {
		const child = httpApp<{}>()
		child.get("/child").handler((c) => {
			c.tap(audit, { action: "child", actor_id: "sys" })
			return c.res.json("ok", {})
		})
		const parent = httpApp<{}>().tap(audit)
		parent.route(child)
		parent.get("/parent").handler((c) => {
			expectTypeOf(c.tap(audit, { action: "test", actor_id: "sys" })).toBeVoid()
			// @ts-expect-error still typed
			c.tap(audit, { action: 1 })
			return c.res.json("ok", {})
		})
	})
})

describe("payload shapes", () => {
	// v0: 952178b9f4
	// v0: 9aff5039d2
	// v0: 6c6c854912
	it("nested objects, unions and arrays type both ends", () => {
		const nested = defineTap(
			"nested",
			z.object({ action: z.string(), metadata: z.object({ ip: z.string(), ua: z.string() }) }),
			(_ctx, payload) => expectTypeOf(payload.metadata.ip).toEqualTypeOf<string>(),
		)
		const batch = defineTap("batch", z.object({ ids: z.array(z.string()), operation: z.string() }), (_ctx, payload) =>
			expectTypeOf(payload.ids).toEqualTypeOf<string[]>(),
		)
		const event = defineTap(
			"event",
			z.discriminatedUnion("type", [
				z.object({ id: z.string(), type: z.literal("created") }),
				z.object({ reason: z.string(), type: z.literal("deleted") }),
			]),
			() => {},
		)
		httpApp<{}>()
			.tap(nested)
			.tap(batch)
			.tap(event)
			.get("/t")
			.handler((c) => {
				c.tap(nested, { action: "create", metadata: { ip: "1.2.3.4", ua: "chrome" } })
				c.tap(batch, { ids: ["a"], operation: "delete" })
				c.tap(event, { id: "1", type: "created" })
				c.tap(event, { reason: "cleanup", type: "deleted" })
				// @ts-expect-error deleted carries a reason, not an id
				c.tap(event, { id: "1", type: "deleted" })
				return c.res.json("ok", {})
			})
	})

	it("$taps stays {}: a tap is no part of the app's type", () => {
		expectTypeOf<ReturnType<typeof httpApp<{}>>["$taps"]>().toEqualTypeOf<{}>()
		const app = httpApp<{}>().tap(audit)
		expectTypeOf<(typeof app)["$taps"]>().toEqualTypeOf<{}>()
	})
})
