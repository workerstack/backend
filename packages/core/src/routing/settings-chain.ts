/**
 * The settings setters every app handle and preset shares: each applies to the whole app and returns the handle.
 */
import type { HttpError } from "../errors/error.ts"
import type { ErrorFormat } from "../errors/problem-json.ts"
import type { PayloadErrorFormatter, ErrorFormatter } from "../errors/projector.ts"
import type { TapDefinition } from "../routing/define-tap.ts"
import type { HttpMetaSpec, MetaSpecConfig } from "../meta/meta-spec-merge.ts"
import { type BackendLogger, SILENT } from "../telemetry/logger.ts"
import type { OtelTelemetry } from "../telemetry/request-trace.ts"
import type { InferOutput, StandardSchemaLike } from "../validation/standard-schema.ts"
import type { WSAdapter } from "../ws/contract.ts"
import type { AddDefaults, FactoryKeys, Retyped, SetFactory, WithMetaType } from "./retype.ts"
import {
	type AppSettings,
	type ErrorI18n,
	normalizeStripPrefix,
	type OnErrorFn,
	type OnMethodNotAllowedFn,
	type OnNotFoundFn,
	type RequestLogOptions,
} from "./settings.ts"

/** The settings surface every handle and preset shares: each setter applies to the whole app and returns the handle. */
export abstract class SettingsChain<TEnv> {
	/** The type of the factory set with `errorFactory()`; `never` until then. Type only. */
	declare readonly $errorFactory: unknown
	/** The route meta type declared with `metaType<T>()`; `never` until then. Type only. */
	declare readonly $meta: unknown
	/** Always `{}`: a tap is no part of the app's type. Type only, read by the pinned clients extractor. */
	declare readonly $taps: {}
	protected readonly settings: AppSettings<TEnv>

	/** Takes the settings object shared by every handle of one app. */
	constructor(settings: AppSettings<TEnv>) {
		this.settings = settings
	}

	/** Recompile what the app serves on its next request: a setting finalize reads changed. */
	protected abstract invalidate(): void

	/**
	 * Register a tap made by `defineTap`, under its name; a later tap of that name replaces the earlier. It runs once a
	 * route's handler has answered, and a synchronous tap can delay the response: once if the route's meta sets its
	 * name, and once per `ctx.tap(tap, payload)`. Nothing fires on an error answer, a 404 or 405, an answer from
	 * middleware, or a WebSocket upgrade. A throw is logged as a warning.
	 */
	tap(tap: TapDefinition<string, StandardSchemaLike, TEnv>): this {
		;(this.settings.taps ??= new Map()).set(tap.name, tap as TapDefinition)
		this.invalidate()
		return this
	}

	/**
	 * Type only: declare the route meta type, which constrains what route `.meta()` accepts and types `ctx.meta`; a
	 * meta-fired tap's key joins it through `TapMeta<typeof tap>`. Returns this same handle; set values with `.meta({ … })`.
	 */
	metaType<TNewMeta extends Record<string, unknown>>(): WithMetaType<this, TNewMeta> {
		return this as never
	}

	/**
	 * The app's error factory. A route mounted from an app that set its own keeps that one; a route from an app without a
	 * factory uses this one. The keys `not_found`, `method_not_allowed` and `bad_request`, when the factory has them, build
	 * backend's own 404, 405 and 400 answers.
	 */
	errorFactory<TFactory extends Record<string, (...args: never[]) => unknown>>(
		factory: TFactory,
	): Retyped<this, SetFactory<TFactory>> {
		this.settings.errorFactory = factory
		this.invalidate()
		return this as never
	}

	/**
	 * Error keys every route of this app declares, registered before or after the call, except a route mounted from an app
	 * with its own factory, which keeps that app's defaults. A declared key closes a route: `ctx.errors` holds declared keys
	 * only, and a thrown `HttpError` with another key (backend's own keys excepted) answers as the boundary error, or a 500.
	 * The keys are typed from the factory, so call `errorFactory()` first.
	 */
	defaultErrors<TThis, const TKeys extends FactoryKeys<TThis>>(
		this: TThis,
		...keys: TKeys[]
	): Retyped<TThis, AddDefaults<TKeys>> {
		const settings = (this as unknown as SettingsChain<unknown>).settings
		for (const key of keys) settings.defaultErrorKeys.add(key)
		;(this as unknown as SettingsChain<unknown>).invalidate()
		return this as never
	}

	/**
	 * The error an undeclared or unknown throw becomes on routes without their own `.boundary()`, except a route mounted
	 * from an app with its own factory, which keeps that app's. `key` also counts as a default error, so it closes every
	 * route as `defaultErrors()` does. A key with a payload schema cannot be built here: the answer is a 500 under that key.
	 * The key is typed from the factory, so call `errorFactory()` first.
	 */
	defaultBoundary<TThis, const TKey extends FactoryKeys<TThis>>(
		this: TThis,
		key: TKey,
	): Retyped<TThis, AddDefaults<TKey>> {
		const settings = (this as unknown as SettingsChain<unknown>).settings
		settings.defaultBoundaryKey = key
		settings.defaultErrorKeys.add(key)
		;(this as unknown as SettingsChain<unknown>).invalidate()
		return this as never
	}

	/** `"strip"` redirects `/a/` to `/a`, `"enforce"` redirects `/a` to `/a/` (308); `"ignore"` serves both. */
	trailingSlash(mode: "enforce" | "ignore" | "strip"): this {
		this.settings.trailingSlash = mode
		return this
	}

	/** An encoded `/` or `\` in the path is a 400 by default; `"allow"` decodes it into a param value. */
	encodedSlashes(mode: "allow" | "reject"): this {
		this.settings.encodedSlashes = mode
		return this
	}

	/** Strip a URL path prefix before matching: whole segments only; a path without it passes through. */
	stripPrefix(prefix: string): this {
		this.settings.stripPrefix = normalizeStripPrefix(prefix)
		return this
	}

	/**
	 * The policy that maps route meta and schema metadata into the OpenAPI document. Declared once;
	 * a mounted sub-app's is merged under it when a document is built, whichever came first.
	 */
	metaSpec<
		TThis extends {
			/** The app's route meta type. */ readonly $meta: unknown
		},
	>(this: TThis, config: HttpMetaSpec<TThis["$meta"]>): TThis {
		const source = (this as unknown as SettingsChain<TEnv>).settings.metaSpec
		if (source.declared !== null) throw new Error("metaSpec() was already called on this app")
		source.declared = config as MetaSpecConfig
		return this
	}

	/** Where every server-side line goes; default `createLogger()` (by NODE_ENV), `false` for none. */
	logger(logger: BackendLogger | false): this {
		this.settings.logger = logger === false ? SILENT : logger
		return this
	}

	/** One `info` line per request once its body ends (or is aborted); off by default, `skip` drops a line. */
	requestLog(options: boolean | RequestLogOptions): this {
		this.settings.requestLog = options === false ? null : options === true ? {} : options
		return this
	}

	/**
	 * Trace every request (a root span, the middleware and the handler under it) and report thrown
	 * errors in the background. Pass `otelAdapter(api, options)` from `@workerstack/backend/telemetry`.
	 */
	telemetry(value: OtelTelemetry): this {
		if (typeof (value as Partial<OtelTelemetry> | null)?.tracer?.startSpan !== "function") {
			throw new TypeError(
				"app.telemetry(): pass otelAdapter(api) from @workerstack/backend/telemetry, or a value with a tracer",
			)
		}
		this.settings.telemetry = value
		this.invalidate()
		return this
	}

	/**
	 * Translate error answers per request: the message from the locale's template, field paths to
	 * display names. Pass `createErrorTranslator({ errors, fieldNames, resolveLocale })` from
	 * `@workerstack/backend/http/i18n`; a raw config object is refused here, at startup.
	 */
	errorI18n(value: ErrorI18n<TEnv>): this {
		const candidate = value as Partial<ErrorI18n<TEnv>> | null
		if (typeof candidate?.translate !== "function" || typeof candidate.resolveLocale !== "function") {
			throw new TypeError("app.errorI18n(): pass createErrorTranslator() from @workerstack/backend/http/i18n")
		}
		this.settings.errorI18n = value
		return this
	}

	/**
	 * Sets the hook that sees each thrown value before it is answered: return a `HttpError` to replace it, a `Response`
	 * to answer, or nothing for backend's own answer. A throw from the hook is logged and gets backend's own answer too.
	 */
	onError(handler: OnErrorFn<TEnv>): this {
		this.settings.onError = handler
		return this
	}

	/**
	 * Sets the hook that answers a request whose path exists but not for its method; `allowed` lists the methods that do,
	 * and backend adds the `Allow` header to what it returns.
	 */
	onMethodNotAllowed(handler: OnMethodNotAllowedFn<TEnv>): this {
		this.settings.onMethodNotAllowed = handler
		return this
	}

	/** Sets the hook that answers a request that matches no route; without it, backend answers its `not_found` error. */
	onNotFound(handler: OnNotFoundFn<TEnv>): this {
		this.settings.onNotFound = handler
		return this
	}

	/**
	 * The runtime's WebSocket adapter, which ws routes upgrade through: `workersWebSocket()` on
	 * Workers. `serve(app)` sets the runtime's own on Node and Bun when none is set; on Bun, set
	 * it before `serve()`.
	 */
	wsAdapter(adapter: WSAdapter): this {
		this.settings.wsAdapter = adapter
		return this
	}

	/** Answer errors as backend's envelope (the default) or RFC 9457 Problem Details; schema errors keep their body. */
	errorFormat(format: ErrorFormat): this {
		this.settings.errorFormat = format
		return this
	}

	/**
	 * Shape the body of every error without a payload schema: `fn` gets the error and backend's default body (its `digest`
	 * and `vars` included) and returns the schema's output type, and `schema` describes the body in the OpenAPI document.
	 */
	defaultErrorFormatter<TSchema extends StandardSchemaLike>(
		schema: TSchema,
		fn: (error: HttpError, base: Record<string, unknown>) => InferOutput<TSchema>,
	): this
	/**
	 * Shape the body of every error without a payload schema: `fn` gets the error and backend's default body and returns the
	 * body to send. If it throws, the failure is logged and the default body goes out.
	 */
	defaultErrorFormatter(fn: ErrorFormatter): this
	defaultErrorFormatter(
		schemaOrFn: ErrorFormatter | StandardSchemaLike,
		fn?: (error: HttpError, base: Record<string, unknown>) => unknown,
	): this {
		if (typeof schemaOrFn === "function") {
			this.settings.errorSchema = null
			this.settings.errorFormatter = schemaOrFn
		} else {
			this.settings.errorSchema = schemaOrFn
			this.settings.errorFormatter = fn as ErrorFormatter
		}
		return this
	}

	/**
	 * Shape the body of every error `defineErrors` gave a payload schema: `fn` returns the schema's output type, and
	 * `schema` describes the body in the OpenAPI document.
	 */
	payloadErrorFormatter<TSchema extends StandardSchemaLike>(
		schema: TSchema,
		fn: (error: HttpError, data: Record<string, unknown>) => InferOutput<TSchema>,
	): this
	/**
	 * Shape the body of every error `defineErrors` gave a payload schema: `fn` gets the error and its payload and returns
	 * the body to send. If it throws, the failure is logged and the payload goes out.
	 */
	payloadErrorFormatter(fn: PayloadErrorFormatter): this
	payloadErrorFormatter(
		schemaOrFn: PayloadErrorFormatter | StandardSchemaLike,
		fn?: (error: HttpError, data: Record<string, unknown>) => unknown,
	): this {
		if (typeof schemaOrFn === "function") {
			this.settings.payloadErrorSchema = null
			this.settings.payloadErrorFormatter = schemaOrFn
		} else {
			const mapper = fn as (error: HttpError, data: Record<string, unknown>) => Record<string, unknown>
			this.settings.payloadErrorSchema = schemaOrFn
			this.settings.payloadErrorFormatter = (error, data) => mapper(error, data)
		}
		return this
	}
}
