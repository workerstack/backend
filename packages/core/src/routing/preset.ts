/**
 * Presets: the settings and chain middleware an app starts from, written once with the app's own setters and typed as
 * the same chain on an app would be. `httpApp(preset)` starts an app from one; the app copies them, so a setter on it, or
 * on the preset later, changes nothing else.
 */
import type { HttpContext } from "../context/context.ts"
import type { MiddlewareErrorKeys, MiddlewareFn, RuntimeMiddleware } from "../middleware/middleware.ts"
import { HttpApp } from "./app.ts"
import type { WithMiddlewareMeta } from "./app-types.ts"
import { createGraph, SEED } from "./register.ts"
import { type AppSettings, copySettings, createSettings } from "./settings.ts"
import { SettingsChain } from "./settings-chain.ts"

/**
 * Settings an app starts from: every app setter (`metaType`, `metaSpec`, `errorFactory`, `defaultBoundary`, `logger`,
 * `errorI18n`, the error formatters, `requestLog` and the rest) and chain middleware with `use(mw)`, each typed as on
 * an app. Make one with `definePreset<TEnv>()` and start an app from it with `httpApp(preset)`.
 */
export class HttpPreset<
	TEnv,
	TCtx = HttpContext<TEnv>,
	TMeta = never,
	TErrorFactory = never,
	TDefaultErrors extends string = never,
> extends SettingsChain<TEnv> {
	/** The ctx type an app started from this preset begins with. Type only. */
	declare readonly $ctx: TCtx
	/** The error keys every route of an app started from this preset declares. Type only. */
	declare readonly $defaultErrors: TDefaultErrors
	/** The env type given to `definePreset<TEnv>()`. Type only. */
	declare readonly $env: TEnv
	/** The type of the factory set with `errorFactory()`; `never` until then. Type only. */
	declare readonly $errorFactory: TErrorFactory
	/** The route meta type declared with `metaType<T>()`; `never` until then. Type only. */
	declare readonly $meta: TMeta
	/** Always `{}`: a tap is no part of the app's type. Type only, read by the pinned clients extractor. */
	declare readonly $taps: {}
	readonly #chain: readonly RuntimeMiddleware[]

	/** Without arguments, an empty preset, as `definePreset()` makes; the arguments are for the ones `use()` derives. */
	constructor(settings: AppSettings<TEnv> = createSettings(), chain: readonly RuntimeMiddleware[] = []) {
		super(settings)
		this.#chain = chain
	}

	/* a preset serves nothing: there is no compiled table to drop */
	protected override invalidate(): void {}

	/** Chain middleware every app started from this preset runs first: a new preset on the same settings. */
	use<TAdds, TMwMeta = {}, TMwErrors extends string = never>(
		mw: MiddlewareFn<TCtx, TAdds, TMwErrors, TMwMeta>,
	): HttpPreset<
		TEnv,
		TCtx & TAdds,
		WithMiddlewareMeta<TMeta, TMwMeta>,
		TErrorFactory,
		TDefaultErrors | MiddlewareErrorKeys<TMwErrors>
	> {
		return new HttpPreset<TEnv>(this.settings, [...this.#chain, mw as unknown as RuntimeMiddleware]) as never
	}

	/** A new app on a copy of this preset's settings, its chain middleware used in order: what `httpApp(preset)` returns. */
	[SEED](): HttpApp<TEnv> {
		let app = new HttpApp<TEnv>({ ...createGraph(), settings: copySettings(this.settings) as AppSettings<unknown> })
		for (const mw of this.#chain) app = app.use(mw as never) as never
		return app
	}
}

/** An empty preset typed to the runtime env `TEnv`; chain the app's setters on it, then `httpApp(preset)`. */
export function definePreset<TEnv>(): HttpPreset<TEnv> {
	return new HttpPreset<TEnv>()
}
