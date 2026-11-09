/**
 * `#output-check`: the check a route declaring `.output()` runs on what it answers. An answer of a media type the
 * route does not declare is a 500 `output_content_type_mismatch`, compared by exact essence (H18.2). A JSON body is
 * checked against its status's schema, read from the raw body the answer was built from, never by cloning it (H18.1);
 * a stream honey produced is never buffered. Any other declared type is a type contract only (F8), and declared
 * response headers are checked first. Failures are a 500 that names the status key and nothing of the issues.
 *
 * This module is what `#output-check` resolves to by default (package.json `imports`). A Vite production build
 * through `honeyPlugin()`, or a node or bun run started with `--conditions=honey-no-output-check`, resolves
 * output-check-off.ts instead, so none of this is in that bundle or process.
 */
import { EK, HoneyError } from "../errors/error.ts"
import type { MaybePromise } from "../middleware/middleware.ts"
import { bodyKind } from "../input/body-kind.ts"
import { isForwarded, isProducedStream, rawBodyOf } from "../response/builder.ts"
import { parseMediaType } from "../response/media-type.ts"
import { compileResponseHeaders, type HeadersCheck } from "../response/response-headers.ts"
import { codeToStatusKey, type StatusKey } from "../response/status.ts"
import type { StandardSchemaLike } from "./standard-schema.ts"
import type { OutputSchemas, Projection } from "../routing/output-types.ts"
import { projected } from "./projection.ts"
import { type AcceptIssue, type OutputCheck, validateOutput } from "./validate-output.ts"

/**
 * The check for a route declaring `schemas`: its declared headers, then its body, cut to what `projection` selects for
 * the request when it names a selection. Only the no-op answers `null`.
 */
export function outputCheck(
	schemas: OutputSchemas,
	projection: ((ctx: object) => Projection | null) | null = null,
): OutputCheck | null {
	return compileOutput(schemas, compileResponseHeaders(schemas.headers), projection)
}

/** The issues `projection`'s selection for `ctx` explains on `data`, if it names one. */
function cutBy(
	projection: ((ctx: object) => Projection | null) | null,
	ctx: object,
	data: unknown,
): AcceptIssue | undefined {
	const selected = projection?.(ctx) ?? null
	return selected === null ? undefined : (issue) => projected(issue, data, selected)
}

// per-process-constant: text-codec
const decoder = /* @__PURE__ */ new TextDecoder()

/** The retained body as data: an empty one, as `json(undefined)` writes, is `null`. */
function parse(raw: string | Uint8Array): unknown {
	const text = typeof raw === "string" ? raw : decoder.decode(raw)
	return text.length === 0 ? null : (JSON.parse(text) as unknown)
}

/**
 * The check for a route declaring `schemas`: `headers`, its declared headers' check, first, whatever the answer
 * carries. The declared media types are fixed here, once; `redirect` and `headers` name no body type. A `forward()`ed
 * answer passes the body step unread: forwardCheck owns its status and media type.
 */
export function compileOutput(
	schemas: OutputSchemas,
	headers: HeadersCheck | null,
	projection: ((ctx: object) => Projection | null) | null = null,
): OutputCheck {
	const declared = new Set<string>()
	for (const key of Object.keys(schemas)) {
		const mt = key.includes("/") ? parseMediaType(key) : null
		if (mt !== null) declared.add(mt.essence)
	}
	/* a response's status key may be any status, so the 2xx map is read as one keyed by every status */
	const json = (schemas as Record<string, Partial<Record<StatusKey, StandardSchemaLike | true>> | undefined>)[
		"application/json"
	]
	const body = (response: Response, ctx: object): MaybePromise<Response> => {
		/* a forwarded answer is forwardCheck's: its status and media type checked there, its body never read */
		if (bodyKind(response) === "empty" || isForwarded(response)) return response
		const type = response.headers.get("content-type")
		if (type === null) return response
		const essence = parseMediaType(type)?.essence
		if (essence === undefined || !declared.has(essence)) {
			throw new HoneyError({ errorKey: EK.output_content_type_mismatch, status: "internal_server_error" })
		}
		if (essence !== "application/json" || json === undefined || isProducedStream(response)) return response
		const statusKey = codeToStatusKey[response.status]
		const schema = statusKey === undefined ? undefined : json[statusKey]
		if (schema === undefined || schema === true) return response
		const raw = rawBodyOf(response)
		if (raw !== null) {
			const data = parse(raw)
			const pending = validateOutput(schema, statusKey as string, data, cutBy(projection, ctx, data))
			return pending === undefined ? response : pending.then(() => response)
		}
		/* a body honey did not build: read a copy, hand the client the original */
		return response
			.clone()
			.json()
			.then((data: unknown) => validateOutput(schema, statusKey as string, data, cutBy(projection, ctx, data)))
			.then(() => response)
	}
	if (headers === null) return body
	return (response, ctx) => {
		const pending = headers(response)
		return pending === undefined ? body(response, ctx) : pending.then(() => body(response, ctx))
	}
}
