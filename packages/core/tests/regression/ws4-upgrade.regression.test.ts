/**
 * WS4–WS8 findings on the upgrade path, frozen as regressions and driven through `app.fetch`: what
 * an app answers a request carrying `Upgrade` with, and the origin policy of a WebSocket upgrade.
 */
import { describe, expect, it } from "vitest"
import { httpApp } from "../../src/routing/app.ts"
import type { WSAdapter } from "../../src/ws/contract.ts"
import { ws } from "../../src/ws/route.ts"

const upgrading = (upgrade: string) => ({ connection: "Upgrade", upgrade })

describe("WS5: what an app answers an upgrade request with", () => {
	// regression: H5
	// v0: e3e55cc30a
	it("H5: an SSE route reached with `Upgrade: x` streams instead of buffering forever", async () => {
		const app = httpApp<{}>()
		app.get("/events").handler((ctx) =>
			ctx.res.sse(async (stream) => {
				await stream.send({ data: "event 0", event: "message" })
				await new Promise((resolve) => stream.signal.addEventListener("abort", resolve, { once: true }))
			}),
		)
		const client = new AbortController()
		const res = await app.fetch(
			new Request("http://localhost/events", { headers: upgrading("x"), signal: client.signal }),
			{},
		)
		const reader = (res.body as ReadableStream<Uint8Array>).getReader()
		const first = new TextDecoder().decode((await reader.read()).value)
		client.abort()
		expect([res.status, first.includes("data: event 0")]).toEqual([200, true])
	})

	// regression: H6
	// v0: 9c345a8fc5
	it("H6: a non-WebSocket upgrade keeps the route's status, headers and content type", async () => {
		const app = httpApp<{}>()
		app.get("/plain").handler((ctx) => ctx.res.text("ok", "hello world", { headers: { "x-custom": "1" } }))
		const res = await app.fetch(new Request("http://localhost/plain", { headers: upgrading("h2c") }), {})
		expect([
			res.status,
			res.headers.get("x-custom"),
			res.headers.get("content-type")?.startsWith("text/plain"),
			await res.text(),
		]).toEqual([200, "1", true, "hello world"])
	})
})

describe("WS5: a WebSocket upgrade keeps the origin policy", () => {
	// regression: H
	// v0: 34d2aef605
	it("H: a cross-origin WebSocket upgrade carrying cookies is refused", async () => {
		const upgrades: string[] = []
		const adapter: WSAdapter = {
			upgrade() {
				upgrades.push("upgraded")
				const response = new Response(null)
				Object.defineProperty(response, "status", { value: 101 })
				return { response, socket: { close() {}, raw: null, readyState: 1, send() {} } }
			},
		}
		const app = httpApp<{}>().wsAdapter(adapter)
		let opened = false
		ws(app, "/ws-echo").handler({ onOpen: () => void (opened = true) })
		const res = await app.fetch(
			new Request("http://localhost/ws-echo", {
				headers: { ...upgrading("websocket"), cookie: "sid=victim", origin: "https://evil.example" },
			}),
			{},
		)
		expect([res.status, opened, upgrades]).toEqual([403, false, []])
	})
})
