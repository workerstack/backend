/**
 * The request log (H17, off by default): one `info` line per request after its body ends, from the
 * field catalog only, or `"aborted"` when the reader cancels first. The body observer
 * (span-lifecycle.ts) calls the line when the body ended.
 */
import { type RawBody, rawBodyOf } from "../response/builder.ts"
import type { FetchState } from "../routing/dispatch.ts"
import type { AppSettings } from "../routing/settings.ts"
import { pathOf, type RequestLogEntry } from "./fields.ts"
import type { RequestTrace } from "./request-trace.ts"
import type { BodyEnd } from "./span-lifecycle.ts"

/**
 * One observed request: what came in, when, the state routing records so the line can name the
 * route, and its spans when the app has telemetry.
 */
export type Seen = {
	readonly request: Request
	readonly started: number
	state: FetchState | null
	readonly trace: RequestTrace | undefined
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** A media type's essence: `type/subtype`, lowercased, without parameters. */
function essenceOf(value: string | undefined): string {
	const text = value ?? ""
	const semi = text.indexOf(";")
	return (semi === -1 ? text : text.slice(0, semi)).trim().toLowerCase()
}

function kindOf(response: Response, raw: RawBody | null): string {
	if (response.status === 101) return "upgrade"
	const essence = essenceOf(response.headers.get("content-type") ?? undefined)
	if (essence === "text/event-stream") return "sse"
	if (raw === null) return response.body === null ? "empty" : "stream"
	if (essence === "application/json" || essence.endsWith("+json")) return "json"
	return essence.slice(0, essence.indexOf("/")) === "text" ? "text" : "binary"
}

/** Write the line, unless `skip` says not to; a `skip` that throws is logged and the line still written. */
function write(s: AppSettings<unknown>, entry: RequestLogEntry): void {
	const skip = s.requestLog?.skip
	let skipped = false
	if (skip !== undefined) {
		try {
			skipped = skip(entry)
		} catch (error) {
			s.logger.error({ err: error }, "requestLog skip failed")
		}
	}
	if (!skipped) s.logger.info(entry as unknown as Record<string, unknown>, "request")
}

/**
 * The request log's line for the request `response` answers: what the body observer calls once the
 * body ended (`ended`) or was cancelled, with the bytes it carried.
 */
export function requestLine(s: AppSettings<unknown>, seen: Seen, response: Response): BodyEnd {
	const { request, started, state } = seen
	const entry: Mutable<RequestLogEntry> = {
		durationMs: 0,
		kind: kindOf(response, rawBodyOf(response)),
		method: request.method,
		/* the path routing matched, under stripPrefix; the raw URL's before routing ran */
		path: state?.path ?? pathOf(request.url),
		routeId: state?.plan.route.id ?? "",
		status: response.status,
	}
	const requestId = state?.requestId?.id ?? response.headers.get("x-request-id") ?? undefined
	if (requestId !== undefined) entry.requestId = requestId
	if (state?.errorKey !== undefined) entry.errorKey = state.errorKey
	return (ended, bytes) => {
		entry.durationMs = Math.round((performance.now() - started) * 1000) / 1000
		entry.status = ended ? response.status : "aborted"
		if (bytes !== undefined) entry.bytes = bytes
		write(s, entry)
	}
}
