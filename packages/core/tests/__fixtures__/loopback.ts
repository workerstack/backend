/**
 * A loopback HTTP listener for a test whose client is a separate process (the official MCP clients run under node
 * from a pinned install): `serve(app, { hostname, port: 0 })` answers `app.fetch` on a port the OS picks. It is a
 * test fixture only; the product has no server of its own (apps run on Workers).
 */
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { Readable } from "node:stream"

/** A listening server: its origin and its stop. */
export type Listener = { close(timeout?: number): Promise<void>; readonly url: string }

export async function serve(
	app: { fetch(request: Request, env: {}): Response | Promise<Response> },
	options: { hostname: string; port: number },
): Promise<Listener> {
	const server = createServer(async (incoming, outgoing) => {
		const controller = new AbortController()
		outgoing.once("close", () => controller.abort())
		try {
			const hasBody = incoming.method !== "GET" && incoming.method !== "HEAD"
			const headers = new Headers()
			for (const [name, value] of Object.entries(incoming.headers))
				for (const each of Array.isArray(value) ? value : value === undefined ? [] : [value]) headers.append(name, each)
			const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
				body: hasBody ? (Readable.toWeb(incoming) as ReadableStream<Uint8Array>) : undefined,
				duplex: "half",
				headers,
				method: incoming.method,
				signal: controller.signal,
			} as RequestInit)
			const answer = await app.fetch(request, {})
			const heads: [string, string | string[]][] = [...answer.headers].filter(([name]) => name !== "set-cookie")
			outgoing.writeHead(
				answer.status,
				[...heads, ...answer.headers.getSetCookie().map((cookie) => ["set-cookie", cookie])].flat() as string[],
			)
			if (answer.body === null) return void outgoing.end()
			Readable.fromWeb(answer.body as never).pipe(outgoing)
		} catch {
			if (!outgoing.headersSent) outgoing.writeHead(500)
			outgoing.end()
		}
	})
	await new Promise<void>((ready) => server.listen(options.port, options.hostname, ready))
	const { port } = server.address() as AddressInfo
	return {
		close: () =>
			new Promise<void>((done) => {
				server.close(() => done())
				server.closeAllConnections()
			}),
		url: `http://${options.hostname}:${port}`,
	}
}
