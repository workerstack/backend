/**
 * `testClient(app, options)`: requests against an app from a test, each answered as the raw Web `Response`
 * (`@workerstack/backend/testing`). It calls `app.fetch` in process. An opt-in cookie jar carries `Set-Cookie` into
 * the next request. A plain function: nothing registers itself (H23).
 */
import { PEER_ADDRESS } from "../context/peer.ts"

/** Anything with a `fetch` handler, such as a honey app. */
type FetchApp<TEnv> = {
	/** Answers `request`, with `env` as the app's environment. */
	fetch(request: Request, env: TEnv): Response | Promise<Response>
}

/** Per-request options for a `TestClient` call. */
export type TestRequestOptions = {
	/** Sent as `multipart/form-data`, one field per entry. */
	form?: Record<string, string>
	/** Request headers. A `cookie` header is joined with the jar's cookies when `cookies` is on. */
	headers?: Record<string, string>
	/** The peer address the request comes from, as the platform would report it (`ctx.ip`). */
	ip?: string
	/** Sent as `application/json`; wins over `form`. */
	json?: unknown
	/** Set on the URL's query, one parameter per entry. */
	search?: Record<string, string>
}

/** Options for `testClient`. */
export type TestClientOptions<TEnv> = {
	/** Keep each response's `Set-Cookie` and send the cookies on later requests. Default off. */
	cookies?: boolean
	/** Handed to the app as `ctx.env`. */
	env: TEnv
	/** The default peer address for every request; a request's own `ip` wins. */
	ip?: string
}

/**
 * A client for an app under test. Each request method resolves to the raw `Response` and follows no redirect. A
 * `path` is resolved against the app's origin, `http://localhost` in process.
 */
export type TestClient = {
	/** Sends a `DELETE` request. */
	delete(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends a `GET` request. */
	get(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends a `HEAD` request. */
	head(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends an `OPTIONS` request. */
	options(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends a `PATCH` request. */
	patch(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends a `POST` request. */
	post(path: string, options?: TestRequestOptions): Promise<Response>
	/** Sends a `PUT` request. */
	put(path: string, options?: TestRequestOptions): Promise<Response>
	/** Any method, a custom one included. */
	request(method: string, path: string, options?: TestRequestOptions): Promise<Response>
}

const IN_PROCESS_ORIGIN = "http://localhost"

function buildRequest(method: string, path: string, options: TestRequestOptions): Request {
	const url = new URL(path, IN_PROCESS_ORIGIN)
	for (const [key, value] of Object.entries(options.search ?? {})) url.searchParams.set(key, value)
	const headers = new Headers(options.headers)
	let body: BodyInit | null = null
	if (options.json !== undefined) {
		headers.set("content-type", "application/json")
		body = JSON.stringify(options.json)
	} else if (options.form !== undefined) {
		const form = new FormData()
		for (const [key, value] of Object.entries(options.form)) form.append(key, value)
		body = form
	}
	return new Request(url, { body, headers, method })
}

/** A `Set-Cookie` line's name and value, and whether it expires the cookie (`Max-Age<=0`, or `Expires` in the past). */
function parseSetCookie(line: string, now: number): { expired: boolean; name: string; value: string } | null {
	const [pair = "", ...attributes] = line.split(";")
	const eq = pair.indexOf("=")
	const name = pair.slice(0, eq).trim()
	if (eq === -1 || name === "") return null
	let maxAge: number | null = null
	let expires: number | null = null
	for (const attribute of attributes) {
		const at = attribute.indexOf("=")
		const key = (at === -1 ? attribute : attribute.slice(0, at)).trim().toLowerCase()
		const value = at === -1 ? "" : attribute.slice(at + 1).trim()
		if (key === "max-age" && /^-?\d+$/.test(value)) maxAge = Number(value)
		else if (key === "expires" && !Number.isNaN(Date.parse(value))) expires = Date.parse(value)
	}
	/* Max-Age wins over Expires (RFC 6265 §5.3) */
	const expired = maxAge === null ? expires !== null && expires <= now : maxAge <= 0
	return { expired, name, value: pair.slice(eq + 1).trim() }
}

/** A test client for `app`; see `TestClientOptions` for the cookie jar and peer address. */
export function testClient<TEnv>(app: FetchApp<TEnv>, options: TestClientOptions<TEnv>): TestClient {
	const jar = new Map<string, string>()

	const call = async (method: string, path: string, given: TestRequestOptions = {}): Promise<Response> => {
		const headers = { ...given.headers }
		if (options.cookies === true && jar.size > 0) {
			const kept = [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
			headers.cookie = headers.cookie === undefined ? kept : `${headers.cookie}; ${kept}`
		}
		const request = buildRequest(method, path, { ...given, headers })
		const ip = given.ip ?? options.ip
		if (ip !== undefined) Object.defineProperty(request, PEER_ADDRESS, { value: ip })
		const response = await app.fetch(request, options.env)
		if (options.cookies === true) {
			const now = Date.now()
			for (const line of response.headers.getSetCookie()) {
				const cookie = parseSetCookie(line, now)
				if (cookie === null) continue
				if (cookie.expired) jar.delete(cookie.name)
				else jar.set(cookie.name, cookie.value)
			}
		}
		return response
	}

	return {
		delete: (path, given) => call("DELETE", path, given),
		get: (path, given) => call("GET", path, given),
		head: (path, given) => call("HEAD", path, given),
		options: (path, given) => call("OPTIONS", path, given),
		patch: (path, given) => call("PATCH", path, given),
		post: (path, given) => call("POST", path, given),
		put: (path, given) => call("PUT", path, given),
		request: (method, path, given) => call(method, path, given),
	}
}
