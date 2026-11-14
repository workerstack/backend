/**
 * An app driven through `app.fetch`, the way a Workers runtime drives it: bodies both ways, what the
 * answer carries (bodies, redirects, cookies, HEAD, middleware headers), many requests at once staying
 * apart, streams that outlive their first chunk, a stream that holds its producer back from a reader
 * that stops reading, and a client that leaves.
 */
import { describe, expect, it } from "vitest"
import { defineErrors } from "../../src/errors/errors.ts"
import { createMiddleware } from "../../src/middleware/middleware.ts"
import { httpApp } from "../../src/routing/app.ts"

type App = { fetch(request: Request, env: {}): Response | Promise<Response> }

async function send(app: App, path: string, init?: RequestInit) {
	return app.fetch(new Request(`http://localhost${path}`, init), {})
}

/** An app echoing what it reads: text, bytes, or the stream itself. */
function echoApp() {
	const app = httpApp<{}>()
	app.post("/text").handler(async (ctx) => ctx.res.text("ok", await ctx.req.text()))
	app
		.post("/stream")
		.handler((ctx) => ctx.res.raw(new Response(ctx.req.body, { headers: { "content-type": "text/plain" } })))
	app.get("/binary").handler((ctx) => ctx.res.raw(new Response(Uint8Array.from([0, 1, 2, 254, 255]))))
	return app
}

describe("bodies, both ways", () => {
	// v0: c4c9cdbbc9
	// v0: 7b97e6801b
	// v0: 4ef99888bb
	it("a large POST arrives whole, read at once or streamed straight back", async () => {
		const app = echoApp()
		const big = "x".repeat(50_000) + "é".repeat(10_000)
		const [read, streamed] = await Promise.all(
			["/text", "/stream"].map(async (path) => (await send(app, path, { body: big, method: "POST" })).text()),
		)
		expect([read === big, streamed === big]).toEqual([true, true])
	})

	// v0: 7a10f1fa5b
	it("a binary answer arrives byte for byte", async () => {
		expect([...new Uint8Array(await (await send(echoApp(), "/binary")).arrayBuffer())]).toEqual([0, 1, 2, 254, 255])
	})

	// v0: d4d03b69ba
	it("OPTIONS and DELETE carry a body like POST", async () => {
		const app = httpApp<{}>()
		app.options("/x").handler(async (ctx) => ctx.res.text("ok", `options:${await ctx.req.text()}`))
		app.delete("/x").handler(async (ctx) => ctx.res.text("ok", `delete:${await ctx.req.text()}`))
		const answers = await Promise.all([
			send(app, "/x", { body: "b", method: "OPTIONS" }).then((res) => res.text()),
			send(app, "/x", { body: "b", method: "DELETE" }).then((res) => res.text()),
		])
		expect(answers).toEqual(["options:b", "delete:b"])
	})
})

describe("answers: bodies, redirects and cookies", () => {
	// v0: 50d3c466f1
	// v0: 9f04243156
	// v0: c1b2030271
	// v0: a1380035f9
	it("text, a redirect with cookies, and json with cookies, headers and a custom status", async () => {
		const app = httpApp<{}>()
		app.get("/text").handler((ctx) => ctx.res.text("ok", "plain"))
		app.get("/go").handler((ctx) => ctx.res.redirect("found", "/there", { cookies: { s: { value: "1" } } }))
		app
			.get("/json")
			.handler((ctx) =>
				ctx.res.json("created", { id: 7 }, { cookies: { a: { value: "1" } }, headers: { "x-trace": "t1" } }),
			)
		const [text, go, json] = await Promise.all(
			["/text", "/go", "/json"].map((path) => send(app, path, { redirect: "manual" })),
		)
		expect([
			[text.status, await text.text()],
			[go.status, go.headers.get("location"), go.headers.getSetCookie()],
			[json.status, json.headers.get("x-trace"), json.headers.getSetCookie(), await json.json()],
		]).toEqual([
			[200, "plain"],
			[302, "/there", ["s=1"]],
			[201, "t1", ["a=1"], { id: 7 }],
		])
	})

	// v0: a3bd349391
	it("a trailing-slash redirect is a 308 with a relative Location", async () => {
		const app = httpApp<{}>().trailingSlash("strip")
		app.get("/users").handler((ctx) => ctx.res.json("ok", { users: [] }))
		const res = await send(app, "/users/", { redirect: "manual" })
		expect([res.status, res.headers.get("location")]).toEqual([308, "/users"])
	})

	// v0: ac6b792ac8
	// v0: 05725011b6
	// v0: b3d973b0b2
	// v0: 69beeb0e0d
	// v0: 2cf4b77ec2
	// v0: afdb9eb301
	it("every cookie is its own Set-Cookie entry; other headers stay single", async () => {
		const app = httpApp<{}>()
		app.get("/").handler((ctx) =>
			ctx.res.text("ok", "x", {
				cookies: { a: { value: "1" }, b: { httpOnly: true, value: "2" } },
				headers: { "x-one": "1" },
			}),
		)
		const res = await send(app, "/")
		expect([res.headers.getSetCookie(), res.headers.get("x-one")]).toEqual([["a=1", "b=2; HttpOnly"], "1"])
	})
})

/** Middleware that sets x-<name> on the answer after next(). */
const tag = (name: string) =>
	createMiddleware(async (_ctx, next) => {
		const res = await next()
		res.headers.set(`x-${name}`, "1")
		return res
	})

describe("answers: HEAD and middleware", () => {
	// v0: b02c133215
	it("an unknown path is 404; a known path with another method is 405 with Allow", async () => {
		const app = httpApp<{}>()
		app.get("/x").handler((ctx) => ctx.res.text("ok", "x"))
		const [missing, wrong] = await Promise.all([send(app, "/nope"), send(app, "/x", { method: "POST" })])
		expect([missing.status, wrong.status, wrong.headers.get("allow")]).toEqual([404, 405, "GET"])
	})

	// v0: adf3f8f66b
	it("HEAD answers GET's headers and no body", async () => {
		const app = httpApp<{}>()
		app.get("/").handler((ctx) => ctx.res.json("ok", { a: 1 }))
		const res = await send(app, "/", { method: "HEAD" })
		expect([res.status, res.headers.get("content-type")?.includes("application/json"), await res.text()]).toEqual([
			200,
			true,
			"",
		])
	})

	// v0: 0864de0f54
	// v0: 4cffdc3207
	// v0: 6d3883e8c6
	it("headers middleware adds after next() reach the answer, with a sync handler", async () => {
		const app = httpApp<{}>()
		app
			.use(tag("a"))
			.use(tag("b"))
			.use(tag("c"))
			.get("/")
			.handler((ctx) => ctx.res.text("ok", "sync"))
		const res = await send(app, "/")
		expect([["a", "b", "c"].map((n) => res.headers.get(`x-${n}`)), await res.text()]).toEqual([["1", "1", "1"], "sync"])
	})
})

describe("the client that leaves", () => {
	it("ctx.signal aborts when the client leaves mid-request", async () => {
		const reasons: unknown[] = []
		let arrived!: () => void
		const started = new Promise<void>((resolve) => (arrived = resolve))
		const app = httpApp<{}>()
		app.get("/").handler(
			(ctx) =>
				new Promise((resolve) => {
					ctx.signal.addEventListener("abort", () => {
						reasons.push(ctx.signal.reason)
						resolve(ctx.res.text("ok", "late"))
					})
					arrived()
				}),
		)
		const client = new AbortController()
		const pending = send(app, "/", { signal: client.signal })
		await started
		client.abort()
		await pending
		expect(reasons).toHaveLength(1)
		expect((reasons[0] as DOMException).name).toBe("AbortError")
	})
})

const errors = defineErrors({ teapot: "bad_request" })

/** Per-request context from middleware, bodies of several kinds, and typed errors, on one app. */
function busyApp() {
	const app = httpApp<{}>().errorFactory(errors)
	app
		.use(createMiddleware((ctx, next) => next({ requestId: ctx.req.headers.get("x-id") })))
		.post("/echo")
		.handler(async (ctx) => {
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
			const type = ctx.req.headers.get("content-type") ?? ""
			const body = type.includes("json")
				? await ctx.req.json()
				: type.includes("form")
					? Object.fromEntries(await ctx.req.formData())
					: await ctx.req.text()
			return ctx.res.json("ok", { body, id: ctx.requestId })
		})
	app
		.get("/fail")
		.errors("teapot")
		.handler(() => {
			throw errors.teapot()
		})
	return app
}

const kinds = [
	(i: number) => ({ body: JSON.stringify({ i }), expected: { i }, type: "application/json" }),
	(i: number) => ({ body: `a=${i}`, expected: { a: String(i) }, type: "application/x-www-form-urlencoded" }),
	(i: number) => ({ body: `plain ${i}`, expected: `plain ${i}`, type: "text/plain" }),
]

describe("many requests at once stay apart", () => {
	// v0: dd62cd9939
	// v0: a858009b6c
	// v0: cf10d5e0cb
	// v0: 2538cf731f
	// v0: 34107187cc
	// v0: bf19ac5e14
	// v0: ea707a5bf3
	// v0: 7b4dd27b62
	// v0: 8559a0dbe9
	// v0: aa14fe5ac7
	it("100 concurrent requests: each gets its own context, its own body back, and failures their own error", async () => {
		const app = busyApp()
		const answers = await Promise.all(
			Array.from({ length: 100 }, async (_, i) => {
				if (i % 10 === 9) return (await send(app, "/fail")).status
				const { body, expected, type } = (kinds[i % 3] as (typeof kinds)[number])(i)
				const res = await send(app, "/echo", {
					body,
					headers: { "content-type": type, "x-id": `r${i}` },
					method: "POST",
				})
				return JSON.stringify(await res.json()) === JSON.stringify({ body: expected, id: `r${i}` })
			}),
		)
		expect(answers).toEqual(Array.from({ length: 100 }, (_, i) => (i % 10 === 9 ? 400 : true)))
	})

	// v0: ff9890ae7d
	// v0: 6a9ee60038
	// v0: f2aee336b7
	// v0: 326d31ba20
	it("handler errors one after another leave the app answering", async () => {
		const app = httpApp<{}>().logger(false)
		app.get("/boom").handler(() => {
			throw new Error("boom")
		})
		app.get("/ok").handler((ctx) => ctx.res.text("ok", "alive"))
		const statuses = await Promise.all(Array.from({ length: 10 }, async () => (await send(app, "/boom")).status))
		expect([statuses, await (await send(app, "/ok")).text()]).toEqual([Array(10).fill(500), "alive"])
		expect(((await (await send(app, "/boom")).json()) as { error_key: string }).error_key).toBe("internal_server_error")
	})

	// v0: 6332b0e78e
	it("a wrong method under a basePath answers 405 with Allow", async () => {
		const app = httpApp<{}>()
		const api = app.basePath("/api/v1")
		api.get("/users").handler((ctx) => ctx.res.json("ok", { users: [] }))
		api.post("/users").handler((ctx) => ctx.res.json("created", { id: 1 }))
		const res = await send(app, "/api/v1/users", { method: "DELETE" })
		expect([res.status, res.headers.get("allow")]).toEqual([405, "GET, POST"])
	})
})

/** An app that streams: a large generate(), one that waits after its first chunk, and an endless writer. */
function streamingApp() {
	const release = Promise.withResolvers<void>()
	const seen = { produced: 0 }
	const app = httpApp<{}>()
	app.get("/large").handler((ctx) =>
		ctx.res.generate(
			(function* () {
				for (let i = 0; i < 20_000; i++) yield `line ${i}\n`
			})(),
			{ contentType: "text/plain" },
		),
	)
	app.get("/first").handler((ctx) =>
		ctx.res.generate(
			(async function* () {
				yield "first chunk\n"
				await release.promise
				yield "rest\n"
			})(),
			{ contentType: "text/plain" },
		),
	)
	app.get("/flood").handler((ctx) =>
		ctx.res.stream(async (writable) => {
			const writer = writable.getWriter()
			const chunk = new Uint8Array(64 * 1024)
			for (;;) {
				await writer.write(chunk)
				seen.produced++
			}
		}),
	)
	return { app, release, seen }
}

describe("streaming through app.fetch", () => {
	// v0: 06bf64ed3c
	// v0: 0f24187776
	it("a large generate() arrives whole", async () => {
		const text = await (await send(streamingApp().app, "/large")).text()
		expect([text.split("\n").length - 1, text.endsWith("line 19999\n")]).toEqual([20_000, true])
	})

	// v0: 916e1d90bd
	// v0: 87c59a4915
	it("a text/plain generate() of unknown length gives its first chunk before the rest exists", async () => {
		const { app, release } = streamingApp()
		const reader = ((await send(app, "/first")).body as ReadableStream<Uint8Array>).getReader()
		const first = new TextDecoder().decode((await reader.read()).value)
		release.resolve()
		await reader.cancel()
		expect(first).toBe("first chunk\n")
	})

	// v0: 08f9deb182
	// v0: 7fc02285c8
	it("a reader that stops reading holds the producer back: no unbounded buffering", async () => {
		const { app, seen } = streamingApp()
		const res = await send(app, "/flood")
		const reader = (res.body as ReadableStream<Uint8Array>).getReader()
		await reader.read()
		await new Promise((resolve) => setTimeout(resolve, 100))
		const held = seen.produced
		await new Promise((resolve) => setTimeout(resolve, 100))
		const later = seen.produced
		await reader.cancel()
		/* with no backpressure the writer loops without waiting, thousands of 64 KB chunks in 100 ms */
		expect([held < 100, later - held]).toEqual([true, 0])
	})
})
