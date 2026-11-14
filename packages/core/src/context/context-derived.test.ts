import { describe, expect, it } from "vitest"
import { SILENT } from "../telemetry/logger.ts"
import { ABORT_CONTEXT, HttpContext, NO_ROUTE, type RequestState, TAPS } from "./context.ts"

function makeCtx(state?: Partial<RequestState<{ DB: string }>>) {
	return new HttpContext(
		{ env: { DB: "test" }, executionCtx: undefined, logger: SILENT, path: "/test", req: makeReq(), ...state },
		NO_ROUTE,
		{},
	)
}

function makeReq(url = "http://localhost/test", headers?: Record<string, string>): Request {
	return new Request(url, { headers })
}

/* A consumer's service derived `Object.assign(Object.create(ctx), { shardDb })`: on 1.0.0-rc.4 every lazy getter threw
   "Cannot read private member", since a private field lives only on the instance the constructor built. */
function derive(ctx: HttpContext<{ DB: string }>) {
	return Object.assign(Object.create(ctx) as typeof ctx, { shardDb: "s1" })
}

describe("HttpContext > a context derived with Object.create", () => {
	it("reads every lazy view the base has, as the base's own", () => {
		const base = makeCtx({
			req: makeReq("http://localhost/test?a=1&a=2", { cookie: "sid=abc", "x-k": "v" }),
		})
		const derived = derive(base)
		expect(derived.log).toBe(base.log)
		expect(derived.cookies).toEqual({ sid: "abc" })
		expect(derived.headers).toBe(base.headers)
		expect(derived.search).toEqual({ a: "1" })
		expect(derived.searchAll).toBe(base.searchAll)
		expect(derived.signal).toBe(base.signal)
		expect((derived as { shardDb?: string }).shardDb).toBe("s1")
	})

	it("reads every getter on the class without throwing, so a new one cannot bring the fault back", () => {
		const derived = derive(makeCtx())
		const getters = Reflect.ownKeys(HttpContext.prototype).filter(
			(key) => Object.getOwnPropertyDescriptor(HttpContext.prototype, key)?.get !== undefined,
		)
		expect(getters.length).toBeGreaterThanOrEqual(8)
		for (const key of getters) expect(() => Reflect.get(derived, key)).not.toThrow()
	})

	it.each([
		["Object.setPrototypeOf", (ctx: HttpContext<{ DB: string }>) => Object.setPrototypeOf({}, ctx) as typeof ctx],
		["a Proxy", (ctx: HttpContext<{ DB: string }>) => new Proxy(ctx, {})],
	])("reads the original's state through %s too", (_name, wrap) => {
		const base = makeCtx({ req: makeReq("http://localhost/test?a=1", { cookie: "sid=abc" }) })
		const wrapped = wrap(base)
		expect([wrapped.cookies, wrapped.search, wrapped.signal]).toEqual([{ sid: "abc" }, { a: "1" }, base.signal])
		wrapped.tap("k", 1)
		expect(base[TAPS]).toEqual([{ key: "k", payload: 1 }])
	})

	it("logs as the request, whichever context asks first, even one that shadows path", () => {
		const bound: Record<string, unknown>[] = []
		const logger = { ...SILENT, child: (bindings: Record<string, unknown>) => (bound.push(bindings), SILENT) }
		const base = makeCtx({ logger })
		const derived = Object.assign(Object.create(base) as typeof base, { path: "/shadowed" })
		void derived.log
		void base.log
		expect(bound).toHaveLength(1)
		expect(bound[0]).toMatchObject({ path: "/test" })
	})

	it("shares the base's state: a view built through it, its taps and its abort", () => {
		const base = makeCtx()
		const derived = derive(base)
		const signal = derived.signal
		expect(base.signal).toBe(signal)
		derived.tap("billing.paid", { id: 1 })
		expect(base[TAPS]).toEqual([{ key: "billing.paid", payload: { id: 1 } }])
		derived[ABORT_CONTEXT]("timeout")
		expect(base.signal.aborted).toBe(true)
		expect(base.signal.reason).toBe("timeout")
	})
})

type ShardCtx = HttpContext<{ DB: string }> & { shardDb: string }

/* A context the way a middleware's `next({ shardDb })` leaves it: the member on the instance itself. */
function shardCtx(state?: Partial<RequestState<{ DB: string }>>): ShardCtx {
	return Object.assign(makeCtx(state), { shardDb: "s0" })
}

describe("HttpContext > c.with", () => {
	it("answers the override and reads every other member from the base, even one set later", () => {
		const base = shardCtx({ req: makeReq("http://localhost/test?a=1&a=2", { cookie: "sid=abc", "x-k": "v" }) })
		const derived = base.with({ shardDb: "s1" })
		;(base as { later?: number }).later = 7
		expect(derived.shardDb).toBe("s1")
		expect(base.shardDb).toBe("s0")
		expect((derived as { later?: number }).later).toBe(7)
		expect(derived.log).toBe(base.log)
		expect(derived.cookies).toEqual({ sid: "abc" })
		expect(derived.headers).toBe(base.headers)
		expect(derived.search).toEqual({ a: "1" })
		expect(derived.searchAll).toBe(base.searchAll)
		expect(derived.signal).toBe(base.signal)
		expect(derived.ip).toBe(base.ip)
		expect(derived.errors).toBe(base.errors)
		expect(derived.env).toBe(base.env)
	})

	it("reads every getter on the class without throwing", () => {
		const derived = shardCtx().with({ shardDb: "s1" })
		const getters = Reflect.ownKeys(HttpContext.prototype).filter(
			(key) => Object.getOwnPropertyDescriptor(HttpContext.prototype, key)?.get !== undefined,
		)
		for (const key of getters) expect(() => Reflect.get(derived, key)).not.toThrow()
	})

	it("queues its taps and aborts on the base", () => {
		const base = shardCtx()
		const derived = base.with({ shardDb: "s1" })
		derived.tap("billing.paid", { id: 1 })
		expect(base[TAPS]).toEqual([{ key: "billing.paid", payload: { id: 1 } }])
		derived[ABORT_CONTEXT]("timeout")
		expect(base.signal.aborted).toBe(true)
	})

	it("overrides a getter-backed member and an own one, leaving the base's", () => {
		const base = shardCtx()
		const log = { ...SILENT }
		const derived = base.with({ env: { DB: "other" }, log })
		expect([derived.log, derived.env]).toEqual([log, { DB: "other" }])
		expect([base.log === log, base.env]).toEqual([false, { DB: "test" }])
	})

	it("chains: a second with keeps the first's overrides and the base's state", () => {
		const base = shardCtx()
		const derived = base.with({ shardDb: "s1" }).with({ env: { DB: "other" } })
		expect([derived.shardDb, derived.env, derived.signal]).toEqual(["s1", { DB: "other" }, base.signal])
	})
})
