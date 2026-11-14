/**
 * Taps fired: `app.tap(tap)` registers a defined tap (`define-tap.ts`), and a route fires it after its handler
 * answered: each registered tap whose name the route's meta sets, with the meta value parsed once where the routes
 * compile, then each `ctx.tap(tap, payload)` the handler called, parsed at the call. Nothing fires on an error answer,
 * a 404 or 405, a middleware that answered without the handler, or an upgrade. A tap runs after the response, in the
 * background (`waitUntil` where there is one), so it never delays or shapes it; a failing tap is contained
 * (invokeUser) and logged as a warn, "tap failed", never reaching onError.
 */
import { HttpError } from "../errors/error.ts"
import { type HttpContext, REQUEST, type RequestState, TAPS } from "../context/context.ts"
import type { CompiledChain, MaybePromise } from "../middleware/middleware.ts"
import { invokeUser } from "../realtime/invoke-user.ts"
import type { TapDefinition } from "./define-tap.ts"
import type { AppSettings } from "./settings.ts"

/** One tap to fire and its parsed payload. */
export type TapFiring = { readonly payload: unknown; readonly tap: TapDefinition }

/** The taps registered for a route, by name. */
export type Taps = ReadonlyMap<string, TapDefinition>

/**
 * The taps a route fires: those of the app serving it and of the app it was registered on; `null` for none. A name
 * is one tap: two different taps under one name on those two apps throw where the routes compile, since either
 * app's `ctx.tap()` would otherwise fire the other's.
 */
export function tapsFor(serving: AppSettings<unknown>, own: AppSettings<unknown>): Taps | null {
	/* a taps map exists only once a tap is set: never empty */
	const outer = serving.taps
	const inner = own === serving ? null : own.taps
	if (inner === null) return outer
	if (outer === null) return inner
	for (const [name, tap] of inner) {
		const other = outer.get(name)
		if (other !== undefined && other !== tap) {
			throw new Error(`tap ${name}: a mounted app and the app serving it register two different taps of this name`)
		}
	}
	return new Map([...inner, ...outer])
}

function stateOf(ctx: object): RequestState<unknown> {
	return (ctx as HttpContext)[REQUEST]
}

/** The route handler, marking the request when it answered (a throw or a rejection marks nothing). */
export function answering(handler: (ctx: object) => MaybePromise<Response>): (ctx: object) => MaybePromise<Response> {
	return (ctx) => {
		const answer = handler(ctx)
		if (answer instanceof Promise) {
			return answer.then((response) => {
				stateOf(ctx).answered = true
				return response
			})
		}
		stateOf(ctx).answered = true
		return answer
	}
}

/** Run `tap` with `payload` after this turn, contained, in the request's background. */
function schedule(ctx: HttpContext, { payload, tap }: TapFiring): void {
	const warn = (error: unknown) => ctx.log.warn({ err: HttpError.serialize(error), tap: tap.name }, "tap failed")
	ctx.background(
		Promise.resolve().then(() => invokeUser(() => tap.handler(ctx, payload), { onError: warn, phase: "tap" })),
	)
}

/** The route's meta taps, then its `ctx.tap()` calls, when the handler's answer is what goes out. */
function fire(ctx: HttpContext, response: Response, metaCalls: readonly TapFiring[]): void {
	if (stateOf(ctx).answered !== true || ctx.error !== undefined || response.status === 101) return
	for (const call of metaCalls) schedule(ctx, call)
	for (const call of ctx[TAPS] ?? []) schedule(ctx, call)
}

/** `run`, with `taps` registered for `ctx.tap()`, firing once the whole chain settled on the handler's answer. */
export function firing(run: CompiledChain, taps: Taps, metaCalls: readonly TapFiring[]): CompiledChain {
	return (ctx) => {
		stateOf(ctx).taps = taps
		const response = run(ctx)
		if (response instanceof Promise) {
			return response.then((settled) => {
				fire(ctx as HttpContext, settled, metaCalls)
				return settled
			})
		}
		fire(ctx as HttpContext, response, metaCalls)
		return response
	}
}
