/**
 * The error boundary of every `next()` and the app's `onError`: what a handler or middleware threw
 * becomes the Response that replaces it. `onError` is awaited and response-shaping: it returns a
 * HttpError to replace the error, a Response to answer, or nothing to fall through to the native
 * projection. The boundary never rejects.
 *
 * Every 5xx error answer gets a digest and one operator line: the client's body carries the digest,
 * the line carries it with what was thrown (name, message, stack, cause chain) and the request (H17).
 */
import { type HttpContext, REQUEST, setCtxError } from "../context/context.ts"
import type { MaybePromise } from "../middleware/middleware.ts"
import type { FetchState } from "../routing/dispatch.ts"
import type { AppSettings, ErrorCtx, ErrorI18n } from "../routing/settings.ts"
import { invokeUser } from "../realtime/invoke-user.ts"
import { pathOf, requestBindings } from "../telemetry/fields.ts"
import type { RequestTrace, OtelTelemetry, TelemetryErrorReport } from "../telemetry/request-trace.ts"
import { HttpError, hasUnknownStatus } from "./error.ts"
import {
	asHttpError,
	createErrorResponse,
	type ErrorAnswer,
	type FormatterReport,
	projectThrown,
	safeErrorResponse,
} from "./projector.ts"

function stateOf(ctx: object): FetchState {
	return (ctx as HttpContext<unknown>)[REQUEST] as FetchState
}

/** A crashed error formatter, logged with the request it answered (when there is one). */
export function formatterReport(s: AppSettings<unknown>, state: FetchState | null): FormatterReport {
	return (failure) => {
		const where = state === null ? {} : requestBindings(state.req.method, state.path, state.plan.route.id)
		s.logger.error({ ...where, err: HttpError.serialize(failure) }, "error formatter failed")
	}
}

/** What `onError`, `onNotFound` and `onMethodNotAllowed` receive. */
export function errorCtx(s: AppSettings<unknown>, state: FetchState): ErrorCtx<unknown> {
	return {
		env: state.env,
		jsonFromError: (err) =>
			createErrorResponse(err, s.errorFormatter, s.payloadErrorFormatter, {
				format: s.errorFormat,
				report: formatterReport(s, state),
			}),
		req: state.req,
	}
}

/** How an error answers for `ctx`: its format, its request id as the instance. */
function answerFor(s: AppSettings<unknown>, ctx: object): ErrorAnswer {
	const state = stateOf(ctx)
	return {
		digest: state.digest,
		format: s.errorFormat,
		instance: (ctx as { requestId?: string }).requestId ?? null,
		report: formatterReport(s, state),
	}
}

/** The response for `error`, recording it on `ctx.error`. */
function respond(s: AppSettings<unknown>, ctx: object, error: HttpError): Response {
	setCtxError(ctx as HttpContext, error)
	return createErrorResponse(error, s.errorFormatter, s.payloadErrorFormatter, answerFor(s, ctx))
}

/**
 * `error` in the request's locale: a translated copy, the thrown error never changed. A failing
 * `resolveLocale` or `translate` is a warn, and the error answers untranslated. Never rejects.
 */
async function translated(s: AppSettings<unknown>, i18n: ErrorI18n, ctx: object, error: HttpError): Promise<HttpError> {
	try {
		const c = ctx as HttpContext
		const state = stateOf(ctx)
		const locale = await i18n.resolveLocale({
			cookies: c.cookies,
			env: state.env,
			headers: c.headers,
			params: c.params,
			req: state.req,
			search: c.search,
		})
		return i18n.translate(error, locale)
	} catch (failure) {
		s.logger.warn({ ...bindings(ctx), err: HttpError.serialize(failure) }, "error i18n failed")
		return error
	}
}

/** Answer with `error`, translated first when the app has errorI18n (only then asynchronously). */
function answer(s: AppSettings<unknown>, ctx: object, error: HttpError): MaybePromise<Response> {
	const i18n = s.errorI18n
	if (i18n === null) return respond(s, ctx, error)
	return translated(s, i18n, ctx, error).then((localized) => respond(s, ctx, localized))
}

/** One throw on its way to a response: the context, what was thrown, and the error it projects to. */
type Throw = { readonly ctx: object; readonly error: HttpError; readonly thrown: unknown }

/** What an operator line says about the request: method, path without its query, route id. */
function bindings(ctx: object): Record<string, string> {
	const state = stateOf(ctx)
	return requestBindings(state.req.method, state.path, state.plan.route.id, {
		requestId: (ctx as { requestId?: string }).requestId,
		trace: state.trace?.ids(),
	})
}

/** Sixteen hex characters, random per occurrence: it names the line, it says nothing about the error. */
function newDigest(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8))
	let hex = ""
	for (const byte of bytes) hex += byte.toString(16).padStart(2, "0")
	return hex
}

/**
 * A 5xx answer's digest, kept on the request (a thrown instance may be shared), and its one
 * operator line: what was thrown, the key it answers as, and the request.
 */
function serverError(s: AppSettings<unknown>, t: Throw, error: HttpError, msg: string): void {
	if (error.status < 500) return
	const digest = newDigest()
	stateOf(t.ctx).digest = digest
	s.logger.error({ ...bindings(t.ctx), digest, err: HttpError.serialize(t.thrown), errorKey: error.errorKey }, msg)
}

/** Answer an error nothing handled: a HttpError the app threw as it is, anything else as the boundary projects it. */
function unhandled(s: AppSettings<unknown>, t: Throw): MaybePromise<Response> {
	serverError(s, t, t.error, t.error === t.thrown ? "server error" : "unhandled error")
	return answer(s, t.ctx, t.error)
}

/** A failing onError: logged once, then the native projection answers. */
function onErrorFailed(s: AppSettings<unknown>, t: Throw, failure: unknown): MaybePromise<Response> {
	s.logger.error({ ...bindings(t.ctx), err: HttpError.serialize(failure) }, "onError failed")
	return unhandled(s, t)
}

/** Apply what `onError` returned: a HttpError replaces the error, a Response answers, nothing falls through. */
function settleOnError(s: AppSettings<unknown>, t: Throw, result: unknown): MaybePromise<Response> {
	if (result instanceof HttpError) {
		const error = hasUnknownStatus(result) ? projectThrown(result, stateOf(t.ctx).plan.policy) : result
		serverError(s, t, error, "server error")
		return answer(s, t.ctx, error)
	}
	if (result instanceof Response) {
		setCtxError(t.ctx as HttpContext, t.error)
		return result as Response
	}
	return unhandled(s, t)
}

function convertWith(s: AppSettings<unknown>, thrown: unknown, ctx: object): MaybePromise<Response> {
	const t: Throw = { ctx, error: projectThrown(thrown, stateOf(ctx).plan.policy), thrown }
	const onError = s.onError
	if (onError === null) return unhandled(s, t)
	let result: unknown
	try {
		result = onError(thrown, errorCtx(s, stateOf(ctx)))
	} catch (failure) {
		return onErrorFailed(s, t, failure)
	}
	if (!(result instanceof Promise)) return settleOnError(s, t, result)
	return result.then(
		(value: unknown) => settleOnError(s, t, value),
		(failure: unknown) => onErrorFailed(s, t, failure),
	)
}

/**
 * A thrown error whose answer is decided: its `http.error` span, and `telemetry.onError` in the
 * request's background, contained (a failure is a warn). Never throws.
 */
function reportThrow(s: AppSettings<unknown>, telemetry: OtelTelemetry, ctx: object, thrown: unknown): void {
	const c = ctx as HttpContext<unknown>
	const state = stateOf(ctx)
	/* the boundary has answered: ctx.error holds what it answered as */
	const httpError = c.error as HttpError
	const digest = state.digest
	/* telemetry on: every request it serves has a trace */
	const trace = state.trace as RequestTrace
	trace.error(httpError, thrown, digest)
	const onError = telemetry.onError
	if (onError === null) return
	const report: TelemetryErrorReport = {
		durationMs: Math.round((performance.now() - trace.started) * 1000) / 1000,
		error: thrown,
		httpError,
		method: state.req.method,
		path: pathOf(state.req.url),
		routeId: state.plan.route.id,
		...(digest !== undefined && { digest }),
		...trace.ids(),
	}
	const warn = (error: unknown) => s.logger.warn({ err: HttpError.serialize(error) }, "telemetry onError failed")
	c.background(Promise.resolve().then(() => invokeUser(() => onError(report), { onError: warn, phase: "telemetry" })))
}

/** The error boundary of every `next()`: what was thrown becomes the Response that replaces it. Never rejects. */
export function boundary(s: AppSettings<unknown>): (thrown: unknown, ctx: object) => MaybePromise<Response> {
	/* answering the error failed itself: what failed is logged, and the last-resort answer goes out */
	const reportAndAnswer = (thrown: unknown, ctx: object, failure: unknown): Response => {
		s.logger.error({ ...bindings(ctx), err: HttpError.serialize(failure) }, "error response failed")
		setCtxError(ctx as HttpContext, asHttpError(thrown))
		return safeErrorResponse(thrown, s.errorFormatter, s.payloadErrorFormatter, answerFor(s, ctx))
	}
	const answered = (thrown: unknown, ctx: object): MaybePromise<Response> => {
		try {
			const res = convertWith(s, thrown, ctx)
			return res instanceof Promise ? res.catch((failure: unknown) => reportAndAnswer(thrown, ctx, failure)) : res
		} catch (failure) {
			return reportAndAnswer(thrown, ctx, failure)
		}
	}
	/* telemetry hears the error once its answer is decided, and never changes it */
	return (thrown, ctx) => {
		const res = answered(thrown, ctx)
		const telemetry = s.telemetry
		if (telemetry === null) return res
		if (!(res instanceof Promise)) {
			reportThrow(s, telemetry, ctx, thrown)
			return res
		}
		return res.then((settled) => {
			reportThrow(s, telemetry, ctx, thrown)
			return settled
		})
	}
}
