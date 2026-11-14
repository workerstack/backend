import { describe, expect, it } from "vitest"
import * as z from "zod"
import { HttpError } from "../errors/error.ts"
import { defineErrors } from "../errors/errors.ts"
import { createMiddleware } from "../middleware/middleware.ts"
import { generateOpenApi } from "../openapi/generate.ts"
import type { StandardSchemaLike } from "../validation/standard-schema.ts"
import { createLogger } from "../telemetry/logger.ts"
import type { WSAdapter, WSContext } from "../ws/contract.ts"
import { ws } from "../ws/route.ts"
import { httpApp } from "./app.ts"
import { defineTap, type TapDefinition } from "./define-tap.ts"

const get = (path: string, init: RequestInit = {}) => new Request(`http://app.test${path}`, init)
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
const anything = z.unknown()

/** Taps recording every call they receive, as [name, payload], and an app registering them. */
function recording() {
	const received: [string, unknown][] = []
	const recorder = <const N extends string>(name: N) =>
		defineTap(name, anything, (_ctx, payload) => void received.push([name, payload]))
	const taps = { audit: recorder("audit"), n: recorder("n"), purge: recorder("purge"), webhook: recorder("webhook") }
	const app = httpApp<{ REGION: string }>().tap(taps.audit).tap(taps.n).tap(taps.purge).tap(taps.webhook)
	return { app, received, taps }
}

/** An app whose logger writes each line into `lines`. */
function logged() {
	const lines: Record<string, unknown>[] = []
	const logger = createLogger({
		format: "json",
		level: "info",
		write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
	})
	return { lines, logger }
}

const errMessages = (lines: Record<string, unknown>[]) =>
	lines.flatMap((line) => (line.err === undefined ? [] : [(line.err as { message: string }).message]))

describe("c.tap(): payloads queued during the handler fire after its answer", () => {
	// v0: c884d2e967
	// v0: ef3d085579
	// v0: 82c8527a37
	it("each call fires its tap once, in call order, the same tap as often as called", async () => {
		const { app, received, taps } = recording()
		app.get("/t").handler((ctx) => {
			ctx.tap(taps.audit, { action: "first" })
			ctx.tap(taps.webhook, { event: "created" })
			ctx.tap(taps.audit, { action: "second" })
			return ctx.res.json("ok", {})
		})
		const res = await app.fetch(get("/t"), { REGION: "eu" })
		expect([res.status, received]).toEqual([
			200,
			[
				["audit", { action: "first" }],
				["webhook", { event: "created" }],
				["audit", { action: "second" }],
			],
		])
	})

	it("the handler gets the schema's output, not what c.tap was given", async () => {
		const received: unknown[] = []
		const count = defineTap("count", z.object({ n: z.coerce.number() }), (_ctx, payload) => void received.push(payload))
		const app = httpApp<{}>().tap(count)
		app.get("/t").handler((ctx) => {
			ctx.tap(count, { n: "3" as unknown as number })
			return ctx.res.json("ok", {})
		})
		await app.fetch(get("/t"), {})
		expect(received).toEqual([{ n: 3 }])
	})
})

describe("c.tap(): a payload its schema refuses", () => {
	it("throws at the call, so the request answers 500, the log names the tap and the issue, and nothing fires", async () => {
		const received: unknown[] = []
		const email = defineTap("email", z.object({ to: z.email() }), (_ctx, payload) => void received.push(payload))
		const { lines, logger } = logged()
		const app = httpApp<{}>().logger(logger).tap(email)
		app.get("/t").handler((ctx) => {
			ctx.tap(email, { to: "not-an-email" })
			return ctx.res.json("ok", {})
		})
		const res = await app.fetch(get("/t"), {})
		await settle()
		expect([res.status, received, errMessages(lines)]).toEqual([
			500,
			[],
			["tap email: the payload fails its schema: to: Invalid email address"],
		])
	})

	it("an issue with no path names the root", async () => {
		const flag = defineTap("flag", z.boolean(), () => {})
		const { lines, logger } = logged()
		const app = httpApp<{}>().logger(logger).tap(flag)
		app.get("/t").handler((ctx) => {
			ctx.tap(flag, "yes" as unknown as boolean)
			return ctx.res.json("ok", {})
		})
		const res = await app.fetch(get("/t"), {})
		expect([res.status, errMessages(lines)]).toEqual([
			500,
			["tap flag: the payload fails its schema: (root): Invalid input: expected boolean, received string"],
		])
	})

	it("a schema that validates asynchronously throws a TypeError", async () => {
		const asyncSchema: StandardSchemaLike = {
			"~standard": { validate: async (value: unknown) => ({ value }), vendor: "test", version: 1 },
		}
		const later = defineTap("later", asyncSchema, () => {})
		const { lines, logger } = logged()
		const app = httpApp<{}>().logger(logger).tap(later)
		app.get("/t").handler((ctx) => {
			try {
				ctx.tap(later, {})
			} catch (error) {
				return ctx.res.json("ok", { name: (error as Error).name, message: (error as Error).message })
			}
			return ctx.res.json("ok", {})
		})
		const res = await app.fetch(get("/t"), {})
		expect([res.status, await res.json(), lines.length]).toEqual([
			200,
			{
				message: "tap later: its schema validates asynchronously; a tap's schema must validate synchronously",
				name: "TypeError",
			},
			0,
		])
	})
})

/** What `c.tap(tap, {})` threw on a route of `app`, or `null`. */
async function thrownBy(app: ReturnType<typeof httpApp<{}>>, tap: TapDefinition, path = "/t") {
	let thrown: unknown = null
	app.get(path).handler((ctx) => {
		try {
			ctx.tap(tap, {})
		} catch (error) {
			thrown = error
		}
		return ctx.res.json("ok", {})
	})
	await app.fetch(get(path), {})
	return thrown === null ? null : (thrown as Error).message
}

describe("c.tap(): only a registered tap", () => {
	it("a tap the app never registered throws, and so does another tap of a registered name", async () => {
		const email = defineTap("email", anything, () => {})
		const other = defineTap("other", anything, () => {})
		const twin = defineTap("email", anything, () => {})
		expect([await thrownBy(httpApp<{}>().tap(email), other), await thrownBy(httpApp<{}>().tap(email), twin)]).toEqual([
			"tap other: not registered on this app",
			"tap email: not registered on this app",
		])
	})

	it("an app with no taps throws for any tap", async () => {
		expect(
			await thrownBy(
				httpApp<{}>(),
				defineTap("email", anything, () => {}),
			),
		).toBe("tap email: not registered on this app")
	})

	it("a WebSocket route's upgrade fires no taps: c.tap there throws", async () => {
		const email = defineTap("email", anything, () => {})
		const socket: WSContext = { close: () => {}, raw: null, readyState: 1, send: () => {} }
		const adapter: WSAdapter = {
			upgrade: () => ({ response: new Response(null, { status: 200 }), socket }),
		}
		let thrown: unknown = null
		const app = httpApp<{}>()
			.wsAdapter(adapter)
			.tap(email)
			.use(
				createMiddleware((ctx, next) => {
					try {
						ctx.tap(email, {})
					} catch (error) {
						thrown = error
					}
					return next()
				}),
			)
		ws(app, "/live").handler({})
		await app.fetch(
			new Request("http://app.test/live", {
				headers: { connection: "Upgrade", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==", upgrade: "websocket" },
			}),
			{},
		)
		expect((thrown as Error | null)?.message).toBe("tap email: a WebSocket upgrade fires no taps")
	})
})

describe("c.tap(): mounted apps", () => {
	it("a sub's route fires a tap the parent registered, and one the sub registered; one neither registered throws", async () => {
		const seen: string[] = []
		const fromParent = defineTap("parent", anything, () => void seen.push("parent"))
		const fromSub = defineTap("sub", anything, () => void seen.push("sub"))
		const stray = defineTap("stray", anything, () => {})
		let thrown: unknown = null
		const sub = httpApp<{}>().tap(fromSub)
		sub.get("/child").handler((ctx) => {
			ctx.tap(fromParent, {})
			ctx.tap(fromSub, {})
			try {
				ctx.tap(stray, {})
			} catch (error) {
				thrown = error
			}
			return ctx.res.json("ok", {})
		})
		const parent = httpApp<{}>().tap(fromParent).route(sub)
		await parent.fetch(get("/child"), {})
		expect([seen, (thrown as Error | null)?.message]).toEqual([
			["parent", "sub"],
			"tap stray: not registered on this app",
		])
	})
})

describe("app.tap(): one tap per name across a mount", () => {
	it("the same tap on both apps is one tap; two different taps of one name throw where the routes compile", async () => {
		const seen: string[] = []
		const audit = defineTap("audit", anything, () => void seen.push("audit"))
		const twin = defineTap("audit", anything, () => {})
		const sub = () => {
			const app = httpApp<{}>().tap(audit)
			app.get("/child").handler((ctx) => (ctx.tap(audit, {}), ctx.res.json("ok", {})))
			return app
		}
		await httpApp<{}>().tap(audit).route(sub()).fetch(get("/child"), {})
		expect(seen).toEqual(["audit"])
		expect(() => httpApp<{}>().tap(twin).route(sub()).fetch(get("/child"), {})).toThrow(
			"tap audit: a mounted app and the app serving it register two different taps of this name",
		)
	})
})

describe("c.tap(): one queue per request", () => {
	// v0: 741f939aca
	// v0: 645fa8268f
	// v0: d9c2f4b86f
	it("each request has its own queue: 100 calls in one, 5 in each of 50 at once", async () => {
		const { app, received, taps } = recording()
		app.get("/many").handler((ctx) => {
			for (let i = 0; i < 100; i++) ctx.tap(taps.n, i)
			return ctx.res.json("ok", {})
		})
		app.get("/r/:id").handler((ctx) => {
			for (let i = 0; i < 5; i++) ctx.tap(taps.n, `${ctx.params.id}:${i}`)
			return ctx.res.json("ok", {})
		})
		await app.fetch(get("/many"), { REGION: "eu" })
		await Promise.all(Array.from({ length: 50 }, (_, i) => app.fetch(get(`/r/${i}`), { REGION: "eu" })))
		const perRequest = (id: number) =>
			received.filter(([, p]) => typeof p === "string" && p.startsWith(`${id}:`)).map(([, p]) => p)
		expect([received.length, perRequest(7)]).toEqual([350, ["7:0", "7:1", "7:2", "7:3", "7:4"]])
	})
})

describe("app.tap(): registration", () => {
	// v0: 21b3df6299
	// v0: f5a21f5cb4
	// v0: 51a93aa401
	// v0: ab1bdcfc0d
	it("chainable; a later tap of a name replaces the earlier; shared by every handle; registered after the routes, still fires", async () => {
		const received: string[] = []
		const first = defineTap("audit", anything, () => void received.push("first"))
		const second = defineTap("audit", anything, () => void received.push("second"))
		const app = httpApp<{}>()
		const scoped = app.use(createMiddleware((_ctx, next) => next()))
		scoped.get("/t").handler((ctx) => {
			ctx.tap(second, {})
			return ctx.res.json("ok", {})
		})
		const chained = scoped.tap(first).tap(second)
		await app.fetch(get("/t"), {})
		expect([chained === scoped, received]).toEqual([true, ["second"]])
	})
})

/** An app with recording taps for `purge` and `audit`, whose route meta may carry either. */
function metaApp() {
	const { app, received, taps } = recording()
	return { app: app.metaType<{ audit?: unknown; purge?: unknown }>(), received, taps }
}

describe("meta-driven taps: a route meta key a tap is registered for fires it", () => {
	// v0: 4003bbad46
	// v0: 0a3d596143
	// v0: 84dccc7642
	// v0: 97f511c813
	// v0: 8bb7b91e96
	// v0: daddedc5ca
	it("with the meta value as payload, once per matching key; no key or an undefined value fires nothing", async () => {
		const { app, received } = metaApp()
		app
			.get("/both")
			.meta({ audit: { who: "a" }, purge: { key: "items" } })
			.handler((ctx) => ctx.res.json("ok", {}))
		app.get("/none").handler((ctx) => ctx.res.json("ok", {}))
		app
			.get("/undefined")
			.meta({ audit: undefined })
			.handler((ctx) => ctx.res.json("ok", {}))
		for (const path of ["/both", "/none", "/undefined"]) await app.fetch(get(path), { REGION: "eu" })
		expect(received).toEqual([
			["audit", { who: "a" }],
			["purge", { key: "items" }],
		])
	})

	// v0: f49b814aa4
	// v0: 4451425ccc
	it("chain meta fires on every route of the chain; a route's own meta wins over it", async () => {
		const { app, received } = metaApp()
		const chain = app.meta({ audit: { source: "chain" } })
		chain.get("/a").handler((ctx) => ctx.res.json("ok", {}))
		chain
			.get("/b")
			.meta({ audit: { source: "route" } })
			.handler((ctx) => ctx.res.json("ok", {}))
		await app.fetch(get("/a"), { REGION: "eu" })
		await app.fetch(get("/b"), { REGION: "eu" })
		expect(received).toEqual([
			["audit", { source: "chain" }],
			["audit", { source: "route" }],
		])
	})

	// v0: b399142eba
	it("the meta value is parsed by the tap's schema: the handler gets its output", async () => {
		const received: unknown[] = []
		const purge = defineTap("purge", z.object({ ttl: z.coerce.number() }), (_ctx, p) => void received.push(p))
		const app = httpApp<{}>().metaType<{ purge?: { ttl: string } }>().tap(purge)
		app
			.get("/t")
			.meta({ purge: { ttl: "60" } })
			.handler((ctx) => ctx.res.json("ok", {}))
		await app.fetch(get("/t"), {})
		await app.fetch(get("/t"), {})
		expect(received).toEqual([{ ttl: 60 }, { ttl: 60 }])
	})
})

describe("meta-driven taps: a meta value the tap's schema refuses", () => {
	const email = defineTap("email", z.object({ to: z.email() }), () => {})
	const MESSAGE = 'route POST /x: meta "email" fails tap email\'s schema: to: Invalid email address'

	/** An app with `email` registered and a `POST /x` whose meta carries a bad address. */
	function badMeta() {
		const app = httpApp<{}>().metaType<{ email?: unknown }>().tap(email)
		app
			.post("/x")
			.meta({ email: { to: "nope" }, operationId: "x.create" })
			.handler((ctx) => ctx.res.json("ok", {}))
		return app
	}

	it("app.fetch throws where the routes compile", () => {
		expect(() => badMeta().fetch(get("/x", { method: "POST" }), {})).toThrow(MESSAGE)
	})

	it("generateOpenApi throws it", () => {
		expect(() => generateOpenApi(badMeta(), { info: { title: "t", version: "1" } })).toThrow(MESSAGE)
	})

	it("an app that mounted a sub whose route carries it throws at its own first request", () => {
		const parent = httpApp<{}>().route(badMeta())
		expect(() => parent.fetch(get("/x", { method: "POST" }), {})).toThrow(MESSAGE)
	})
})

describe("meta-driven taps: their order beside c.tap", () => {
	// v0: 043d466d0b
	// v0: 2149fadd7e
	// v0: 503b33d0d7
	it("meta taps fire before c.tap ones, and one tap fires from both", async () => {
		const { app, received, taps } = metaApp()
		app
			.get("/t")
			.meta({ purge: { key: "items" } })
			.handler((ctx) => {
				ctx.tap(taps.audit, { action: "create" })
				ctx.tap(taps.purge, { key: "extra" })
				return ctx.res.json("ok", {})
			})
		await app.fetch(get("/t"), { REGION: "eu" })
		expect(received).toEqual([
			["purge", { key: "items" }],
			["audit", { action: "create" }],
			["purge", { key: "extra" }],
		])
	})
})

/** Routes that tap and then fail every way an answer can: none may fire. */
function failingApp() {
	const errors = defineErrors({ gone: "gone" })
	const { app, received, taps } = recording()
	const withMeta = app.metaType<{ audit?: unknown }>().errorFactory(errors)
	const audited = withMeta.meta({ audit: { on: "chain" } })
	const tapped = (fail: () => never) => (ctx: { tap(tap: TapDefinition, payload: unknown): void }) => {
		ctx.tap(taps.audit, {})
		return fail()
	}
	audited.get("/backend").handler(
		tapped(() => {
			throw new HttpError({ errorKey: "gone", status: "gone" })
		}),
	)
	audited.get("/unknown").handler(
		tapped(() => {
			throw new Error("boom")
		}),
	)
	audited
		.get("/factory")
		.errors("gone")
		.handler((ctx) => {
			ctx.tap(taps.audit, {})
			throw ctx.errors.gone()
		})
	audited
		.use(
			createMiddleware(() => {
				throw new Error("guard")
			}),
		)
		.get("/mw-before")
		.handler((ctx) => ctx.res.json("ok", {}))
	audited
		.use(
			createMiddleware(async (_ctx, next) => {
				await next()
				throw new Error("after")
			}),
		)
		.get("/mw-after")
		.handler((ctx) => {
			ctx.tap(taps.audit, {})
			return ctx.res.json("ok", {})
		})
	audited
		.use(createMiddleware(() => new Response(null, { status: 204 })))
		.get("/short")
		.handler((ctx) => ctx.res.json("ok", {}))
	return { app, received }
}

describe("taps fire only after a handler's answer, never on an error answer", () => {
	// v0: 6b097e878d
	// v0: b24e95281c
	// v0: 74bc76f994
	// v0: a351da1510
	// v0: 59780c02bb
	// v0: a66409cf0d
	it.each([
		["a thrown HttpError", "/backend", 410],
		["an unknown throw", "/unknown", 500],
		["a factory error", "/factory", 410],
		["a 404", "/nowhere", 404],
		["a 405", "/backend?m=post", 405],
		["a middleware throw before the handler", "/mw-before", 500],
		["a middleware throw after the handler answered", "/mw-after", 500],
		["a middleware that answers without calling the handler", "/short", 204],
	])("%s: none", async (_name, path, status) => {
		const { app, received } = failingApp()
		const [route, query] = path.split("?")
		const res = await app.fetch(get(route as string, { method: query === "m=post" ? "POST" : "GET" }), { REGION: "eu" })
		await settle()
		expect([res.status, received]).toEqual([status, []])
	})
})

describe("taps and .input()", () => {
	// v0: 5d8012c8c8
	// v0: 60ef649f55
	it("a tap fires after input validation passed, with the validated value; never when it failed", async () => {
		const received: unknown[] = []
		const audit = defineTap("audit", anything, (_ctx, payload) => void received.push(payload))
		const app = httpApp<{}>().tap(audit)
		app
			.post("/users")
			.input({ json: z.object({ name: z.string() }) })
			.handler((ctx) => {
				ctx.tap(audit, { action: "create", name: ctx.input.json.name })
				return ctx.res.json("created", { ok: true })
			})
		const create = (body: string) =>
			app.fetch(get("/users", { body, headers: { "content-type": "application/json" }, method: "POST" }), {})
		const [bad, good] = [await create('{"name":123}'), await create('{"name":"Alice"}')]
		await settle()
		expect([bad.status, good.status, received]).toEqual([400, 201, [{ action: "create", name: "Alice" }]])
	})
})
