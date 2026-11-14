/**
 * On Cloudflare Workers the exported app is the Worker: `export default app` answers
 * `fetch(request, env, ctx)` and there is no server to start.
 */
import { describe, expect, it, vi } from "vitest"
import { httpApp } from "../../src/routing/app.ts"

describe("Cloudflare Workers: the exported app is the Worker", () => {
	// v0: 4545e7ea27
	it("`export default app` answers fetch(request, env, ctx): there is no server to start", async () => {
		vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" })
		try {
			const worker = httpApp<{}>()
			worker.get("/who").handler((ctx) => ctx.res.json("ok", { ip: ctx.ip }))
			const ctx = { passThroughOnException: () => {}, waitUntil: () => {} }
			const req = new Request("http://h/who", { headers: { "cf-connecting-ip": "203.0.113.9" } })
			expect(await (await worker.fetch(req, {}, ctx)).json()).toEqual({ ip: "203.0.113.9" })
		} finally {
			vi.unstubAllGlobals()
		}
	})
})
