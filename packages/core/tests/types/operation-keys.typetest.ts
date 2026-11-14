/**
 * The operation keys (D2, D3): the ids a filled `HttpCodegen` slot declares, the HTTP ones `invalidate` takes, and
 * `OperationCtx` over one id or several. A slot is built by hand here and read through the `*Of<C>` forms, since a
 * module augmentation in one typetest would fill the global slot for every file in the program; the empty global
 * slot is checked as it is. Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import * as z from "zod"
import type { HttpContext } from "../../src/context/context.ts"
import { defineErrors } from "../../src/errors/errors.ts"
import { createMiddleware } from "../../src/middleware/middleware.ts"
import { httpApp } from "../../src/routing/app.ts"
import type { HttpMeta, InferCtx, InferRouteCtx } from "../../src/routing/app-types.ts"
import type {
	HttpOperationId,
	HttpOperationIdOf,
	OperationCtx,
	OperationCtxOf,
	OperationId,
	OperationIdOf,
} from "../../src/routing/codegen-types.ts"
import type { WSRouteCtx } from "../../src/routing/ws-builder.ts"

type ShardDb = { query: (sql: string) => unknown[] }
const errors = defineErrors({ email_taken: "conflict", org_limit: "forbidden" })
const withShard = createMiddleware((_ctx, next) => next({ shardDb: null as ShardDb | null }))
const withSession = createMiddleware((_ctx, next) => next({ session: { userId: "u-1" } }))

/* two .route() groups with different middleware, errors and outputs */
const groupA = httpApp<{}>()
	.errorFactory(errors)
	.use(withShard)
	.use(withSession)
	.get("/a")
	.meta({ operationId: "a.list" })
	.errors("email_taken", "org_limit")
	.output({ "application/json": { ok: z.object({ items: z.array(z.string()) }) } })
	.handler((c) => c.res.json("ok", { items: [] }))
const groupB = httpApp<{}>()
	.errorFactory(errors)
	.use(withShard)
	.post("/b")
	.meta({ operationId: "b.create" })
	.errors("email_taken")
	.output({ "application/json": { created: z.object({ id: z.string() }) } })
	.handler((c) => c.res.json("created", { id: "b-1" }))
const app = httpApp<{}>().route(groupA).route(groupB)

type CtxA = InferRouteCtx<typeof app, "/a", "get">
type CtxB = InferRouteCtx<typeof app, "/b", "post">
type CtxLive = WSRouteCtx<InferCtx<typeof app>, "/live/:room">

/** The slot as the clients emitter fills it. */
type Slot = {
	operationId: {
		"a.list": { kind: "http"; ctx: CtxA }
		"b.create": { kind: "http"; ctx: CtxB }
		"live.connect": { kind: "ws"; ctx: CtxLive }
	}
}

describe("a filled slot", () => {
	it("names every declared id, and only the HTTP ones as invalidate targets", () => {
		expectTypeOf<OperationIdOf<Slot>>().toEqualTypeOf<"a.list" | "b.create" | "live.connect">()
		expectTypeOf<HttpOperationIdOf<Slot>>().toEqualTypeOf<"a.list" | "b.create">()
	})

	it("types one id as that route's context, an HTTP or a WebSocket one", () => {
		expectTypeOf<OperationCtxOf<Slot, "a.list">>().toEqualTypeOf<CtxA>()
		expectTypeOf<OperationCtxOf<Slot, "live.connect">>().toEqualTypeOf<CtxLive>()
	})

	it("types several ids as one merged context: what every route has, and no request-specific member", () => {
		function step(c: OperationCtxOf<Slot, "a.list" | "b.create">) {
			const derived = c.with({ shardDb: { query: () => [] } })
			expectTypeOf(derived).toEqualTypeOf<typeof c>()
			// @ts-expect-error a number is not a ShardDb
			c.with({ shardDb: 42 })
			expectTypeOf(c.errors.email_taken).toEqualTypeOf(errors.email_taken)
			// @ts-expect-error only a.list declares org_limit
			void c.errors.org_limit
			// @ts-expect-error only a.list's group runs withSession
			void c.session
			c.tap("audit", { at: 1 })
			expectTypeOf(c.shardDb).toEqualTypeOf<ShardDb | null>()
			// @ts-expect-error the handler writes the answer
			void c.res
			// @ts-expect-error request-specific
			void c.req
			// @ts-expect-error request-specific
			void c.input
			// @ts-expect-error request-specific
			void c.params
			// @ts-expect-error request-specific
			void c.meta
			// @ts-expect-error request-specific
			void c.routePattern
		}
		expectTypeOf(step).toBeFunction()
	})
})

describe("the empty slot", () => {
	it("takes any string as an id, and an id's context is HttpContext", () => {
		expectTypeOf<OperationId>().toEqualTypeOf<string>()
		expectTypeOf<HttpOperationId>().toEqualTypeOf<string>()
		expectTypeOf<OperationCtx<"x">>().toEqualTypeOf<HttpContext>()
		expectTypeOf<OperationIdOf<{}>>().toEqualTypeOf<string>()
		expectTypeOf<NonNullable<HttpMeta["invalidate"]>>().toEqualTypeOf<readonly string[]>()
	})
})
