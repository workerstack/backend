/**
 * Response construction. The raw-body side table lets every reader (raw(), HEAD, compress, output
 * validation) find a native response's buffered body (H18.1).
 */

/* weak keys: a response's entry goes with the response; no property is defined on the host object.
 * A stream honey produced (sse, stream, generate) is recorded under PRODUCED instead of a body, a forwarded
 * answer under FORWARDED. */
// per-process-constant: raw-body
const rawBodies = /* @__PURE__ */ new WeakMap<Response, string | Uint8Array | typeof PRODUCED | typeof FORWARDED>()

/** The entry of a response whose body is a stream honey produced: possibly endless, never buffered. */
const PRODUCED: unique symbol = /* @__PURE__ */ Symbol("honey.produced")

/** The entry of a response `forward()` answered: checked against the route's declaration, its body opaque. */
const FORWARDED: unique symbol = /* @__PURE__ */ Symbol("honey.forwarded")

export type RawBody = string | Uint8Array

/**
 * Record the buffered body a native response was built from. Only for a response honey constructed:
 * a recorded body also tells withHeaders the headers are mutable.
 */
export function withRawBody(response: Response, body: RawBody): Response {
	rawBodies.set(response, body)
	return response
}

/** The buffered body a response was built from, or `null` for a streamed or foreign one. */
export function rawBodyOf(response: Response): RawBody | null {
	const raw = rawBodies.get(response)
	return raw === undefined || typeof raw === "symbol" ? null : raw
}

/** Record that `response` streams a body honey produced (sse, stream, generate). */
export function withProducedBody(response: Response): Response {
	rawBodies.set(response, PRODUCED)
	return response
}

/** Whether `response` streams a body honey produced: one never to be buffered, as it may not end. */
export function isProducedStream(response: Response): boolean {
	return rawBodies.get(response) === PRODUCED
}

/** Record that `response` is what `forward()` answered. */
export function withForwarded(response: Response): Response {
	rawBodies.set(response, FORWARDED)
	return response
}

/** Whether `response` is what `forward()` answered: its status and media type checked, its body never read. */
export function isForwarded(response: Response): boolean {
	return rawBodies.get(response) === FORWARDED
}

type ReplaceInit = {
	body?: BodyInit | null
	headers?: HeadersInit
	status?: number
}

/** Rebuild a response with a new status, headers or body; whatever is left out carries over. */
export function replaceResponse(response: Response, init: ReplaceInit): Response {
	/* an upgrade response belongs to the runtime: rebuilding it throws (RangeError) or breaks the socket */
	if (response.status === 101) return response
	const status = init.status ?? response.status
	return new Response(init.body === undefined ? response.body : init.body, {
		/* left out, the headers carry over: a status change must not drop them */
		headers: init.headers ?? response.headers,
		status,
		statusText: status === response.status ? response.statusText : undefined,
	})
}
