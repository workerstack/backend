/**
 * `proxy()` end to end, in process: the destination is a second app, reached the way a Workers
 * service binding is, with `app.fetch`. A destination that stands in for `fetch()` decodes a
 * `Content-Encoding` body and leaves the header on, as the runtime's `fetch()` does.
 */
import { gzipSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import { honey } from "../../src/routing/app.ts"
import { proxy, type ProxyConfig } from "../../src/proxy/proxy.ts"

type Dest = (request: Request, signal: AbortSignal | null | undefined) => Response | Promise<Response>

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** `fetch()` as the runtime has it: the gzip body arrives decoded, its headers as the upstream sent them. */
async function decodeLikeFetch(response: Response): Promise<Response> {
	if (response.headers.get("content-encoding") !== "gzip" || response.body === null) return response
	const headers = new Headers(response.headers)
	headers.delete("content-length")
	return new Response(response.body.pipeThrough(new DecompressionStream("gzip")), { headers, status: response.status })
}

/** `/up/*` proxied to `dest`, which sees what the proxy forwards as a Request. */
function proxied(dest: Dest, extra: Partial<ProxyConfig<unknown>> = {}) {
	const app = honey<{}>().logger(false)
	app.all("/up/*rest").handler(
		proxy({
			destination: async (_ctx, url, init) =>
				decodeLikeFetch(await dest(new Request(`http://upstream.test${url}`, init), init.signal)),
			...extra,
		}),
	)
	return (path: string, init: RequestInit = {}) => app.fetch(new Request(`http://app.test${path}`, init), {})
}

describe("proxy against an upstream, in process: the answer", () => {
	// v0: 09fbb6b204
	// v0: 35b511867c
	it("a gzip body over 256 KB arrives decoded, with headers that describe it", async () => {
		const plain = Buffer.from(JSON.stringify({ items: Array.from({ length: 40_000 }, (_, i) => `item-${i}`) }))
		expect(plain.length).toBeGreaterThan(256 * 1024)
		const send = proxied((request) => {
			const small = request.url.endsWith("/small")
			const body = gzipSync(small ? Buffer.from('{"items":[1,2]}') : plain)
			return new Response(body, {
				headers: {
					"content-encoding": "gzip",
					"content-length": String(body.length),
					"content-type": "application/json",
				},
			})
		})
		const large = await send("/up/large", { headers: { "accept-encoding": "gzip" } })
		const largeBody = Buffer.from(await large.arrayBuffer())
		const declared = large.headers.get("content-length")
		const small = await send("/up/small", { headers: { "accept-encoding": "gzip" } })
		expect([
			large.status,
			large.headers.get("content-encoding"),
			declared === null || Number(declared) === plain.length,
			largeBody.equals(plain),
			small.status,
			small.headers.get("content-encoding"),
			((await small.json()) as { items: unknown[] }).items.length,
		]).toEqual([200, null, true, true, 200, null, 2])
	})

	// v0: 7d15dd4aec
	// v0: 01d6a8af6e
	it("hop-by-hop and Connection-named headers are dropped, each Set-Cookie kept, one framing left", async () => {
		const send = proxied(() => {
			const headers = new Headers({
				connection: "keep-alive, x-hop",
				"keep-alive": "timeout=77",
				"transfer-encoding": "chunked",
				"x-hop": "1",
			})
			headers.append("set-cookie", "a=1")
			headers.append("set-cookie", "b=2")
			return new Response("part-0\npart-1\n", { headers })
		})
		const res = await send("/up/chunked")
		expect([
			res.status,
			await res.text(),
			res.headers.get("keep-alive"),
			res.headers.get("x-hop"),
			res.headers.get("transfer-encoding"),
			res.headers.getSetCookie(),
		]).toEqual([200, "part-0\npart-1\n", null, null, null, ["a=1", "b=2"]])
	})
})

describe("proxy against an upstream, in process: deadlines", () => {
	// v0: 2670221d49
	it("a stream keeps flowing past the header timeout: it covers the headers only", async () => {
		const send = proxied(
			() => {
				const encoder = new TextEncoder()
				return new Response(
					new ReadableStream({
						async start(controller) {
							for (let i = 0; i < 6; i++) {
								controller.enqueue(encoder.encode(`data: ${i}\n\n`))
								await wait(40)
							}
							controller.close()
						},
					}),
					{ headers: { "content-type": "text/event-stream" } },
				)
			},
			{ timeout: 100 },
		)
		const res = await send("/up/sse")
		expect([res.status, (await res.text()).match(/^data: /gm)?.length]).toEqual([200, 6])
	})

	// v0: 639da2521d
	it("no response headers within the timeout is a 504", async () => {
		/* like fetch(), the call rejects with the signal's reason once it aborts */
		const send = proxied(
			(_request, signal) =>
				new Promise<Response>((_resolve, reject) => {
					signal?.addEventListener("abort", () => reject(signal.reason))
				}),
			{ timeout: 50 },
		)
		expect((await send("/up/hang")).status).toBe(504)
	})
})

describe("proxy against an upstream, in process: a stalled body", () => {
	// v0: b4b69459c4
	it("an upstream that stalls mid-body is cut by the idle timeout", async () => {
		const send = proxied(
			() =>
				new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(new TextEncoder().encode("first\n"))
						},
					}),
				),
			{ idleTimeout: 60 },
		)
		const started = Date.now()
		const res = await send("/up/stall")
		const read = await res.text().then(
			(text) => text,
			(error: Error) => error,
		)
		expect([Date.now() - started < 2_000, read instanceof Error || read === "first\n"]).toEqual([true, true])
	})

	// v0: 05492fc681
	it("a redirect goes back to the client, not followed", async () => {
		const send = proxied((request) => {
			expect(request.redirect).toBe("manual")
			return new Response(null, { headers: { location: "/elsewhere" }, status: 302 })
		})
		const res = await send("/up/redirect")
		expect([res.status, res.headers.get("location")]).toEqual([302, "/elsewhere"])
	})
})

describe("proxy against an upstream, in process: what is forwarded", () => {
	// v0: 57864cc3aa
	// v0: 70c9462e8b
	it("a large upload and a DELETE body reach the upstream intact; Host and Expect are not forwarded", async () => {
		const send = proxied(async (request) =>
			Response.json({
				bodySize: (await request.arrayBuffer()).byteLength,
				expect: request.headers.get("expect"),
				forwardedHost: request.headers.get("x-forwarded-host"),
				host: request.headers.get("host"),
				method: request.method,
			}),
		)
		const big = new Uint8Array(3 * 1024 * 1024).fill(7)
		const up = await send("/up/echo", { body: big, method: "POST" })
		const ids = JSON.stringify({ ids: [1, 2, 3] })
		const removed = await send("/up/echo", {
			body: ids,
			headers: { "content-type": "application/json" },
			method: "DELETE",
		})
		type Seen = {
			bodySize: number
			expect: string | null
			forwardedHost: string | null
			host: string | null
			method: string
		}
		const [a, b] = (await Promise.all([up.json(), removed.json()])) as [Seen, Seen]
		expect([
			up.status,
			removed.status,
			a.bodySize,
			a.host === "app.test",
			a.forwardedHost,
			b.bodySize,
			b.method,
		]).toEqual([200, 200, big.length, false, "app.test", ids.length, "DELETE"])
	})
})

describe("proxy against an upstream, in process: what the upstream is told", () => {
	// v0: 18601c550b
	// v0: d6239a3190
	it("client forwarding headers are replaced; hop-by-hop request headers and Expect are dropped", async () => {
		const send = proxied((request) => Response.json(Object.fromEntries(request.headers)))
		const res = await send("/up/echo", {
			headers: {
				connection: "keep-alive, x-secret",
				expect: "100-continue",
				forwarded: "for=6.6.6.6",
				"proxy-authorization": "Basic x",
				upgrade: "h2c",
				"x-forwarded-for": "6.6.6.6",
				"x-real-ip": "6.6.6.6",
				"x-secret": "1",
			},
		})
		const seen = (await res.json()) as Record<string, string>
		expect([
			res.status,
			seen["x-forwarded-for"] === "6.6.6.6",
			seen["x-forwarded-proto"],
			seen.forwarded,
			seen["x-real-ip"],
			seen["x-secret"],
			seen.upgrade,
			seen["proxy-authorization"],
			seen.expect,
		]).toEqual([200, false, "http", undefined, undefined, undefined, undefined, undefined, undefined])
	})

	// v0: 28472fecb1
	it("a client that disconnects mid-body cancels the upstream", async () => {
		let upstreamSignal: AbortSignal | null | undefined
		const client = new AbortController()
		const send = proxied((_request, signal) => {
			upstreamSignal = signal
			return new Response(
				new ReadableStream({
					pull: async (controller) => {
						await wait(10)
						controller.enqueue(new TextEncoder().encode("tick\n"))
					},
				}),
			)
		})
		const res = await send("/up/endless", { signal: client.signal })
		await (res.body as ReadableStream<Uint8Array>).getReader().read()
		expect(upstreamSignal?.aborted).toBe(false)
		client.abort()
		const deadline = Date.now() + 2_000
		while (upstreamSignal?.aborted === false && Date.now() < deadline) await wait(20)
		expect(upstreamSignal?.aborted).toBe(true)
	})
})
