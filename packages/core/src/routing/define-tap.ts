/**
 * A tap's definition: `defineTap(name, schema, handler)` and the check its payload goes through. `defineTap` sets each
 * tap's check under the context's `TAP_CHECK`, so the check is bundled only where an app defines a tap.
 */
import { TAP_CHECK, type TapCheck } from "../context/context.ts"
import type { InferInput, InferOutput, StandardSchemaLike } from "../validation/standard-schema.ts"

/** What a tap handler sees: the request, never `res` or `tap`, so it can neither answer nor recurse. */
export type TapContext<TEnv = unknown> = {
	/** Keeps a promise running past the response: `waitUntil` on Workers; elsewhere a rejection goes to the request's logger. */
	readonly background: (promise: Promise<unknown>) => void
	/** The environment bindings of the request. */
	readonly env: TEnv
	/** The request's headers, with lowercased names. */
	readonly headers: Record<string, string>
	/** The route's meta; empty when it set none. */
	readonly meta: Record<string, unknown>
	/** The matched route's path params. */
	readonly params: Record<string, string>
	/** The normalized request path, without the query or the app's `stripPrefix`. */
	readonly path: string
	/** The incoming request. */
	readonly req: Request
	/** The route's path pattern, such as `/users/:id`. */
	readonly routePattern: string
	/** The query: the first value of each key. */
	readonly search: Record<string, string>
}

/**
 * A defined tap: its name, the schema its payload is parsed by, and the observation hook it runs after a route's
 * handler answered. Made by `defineTap`, registered by `app.tap(tap)`, fired by `c.tap(tap, payload)` or a route meta
 * value under its name. `handler` is a method, so every tap is assignable to the default `TapDefinition`; its check
 * keeps a hand-built object out, since only `defineTap` sets one.
 */
export type TapDefinition<
	TName extends string = string,
	TSchema extends StandardSchemaLike = StandardSchemaLike,
	TEnv = unknown,
> = {
	/** The payload check `defineTap` set: the schema's output, or the first issue. */
	readonly [TAP_CHECK]: TapCheck
	/** The tap's name: the key `app.tap()` registers it under and the route meta key that fires it. */
	readonly name: TName
	/** What a payload must pass; the handler gets its output. */
	readonly schema: TSchema
	/** Runs once the route's answer goes out, with the request and the parsed payload. */
	handler(ctx: TapContext<TEnv>, payload: InferOutput<TSchema>): unknown
}

/** The route meta key a meta-fired tap reads, typed by its schema's input: pass it to `metaType<…>()`. */
export type TapMeta<T extends TapDefinition> = { readonly [K in T["name"]]?: InferInput<T["schema"]> }

/**
 * Define a tap: `name`, the schema its payload is parsed by, and the handler that gets the parsed payload. Register it
 * with `app.tap(tap)` and fire it with `c.tap(tap, payload)`. Throws a TypeError on an empty name.
 */
export function defineTap<const TName extends string, TSchema extends StandardSchemaLike, TEnv = unknown>(
	name: TName,
	schema: TSchema,
	handler: (ctx: TapContext<TEnv>, payload: InferOutput<TSchema>) => unknown,
): TapDefinition<TName, TSchema, TEnv> {
	if (name === "") throw new TypeError("defineTap: a tap needs a name")
	const tap: TapDefinition<TName, TSchema, TEnv> = Object.freeze({
		handler,
		name,
		schema,
		[TAP_CHECK]: (value: unknown) => checkTapPayload(tap, value),
	})
	return tap
}

const keyOf = (segment: PropertyKey | { readonly key: PropertyKey }) =>
	String(typeof segment === "object" ? segment.key : segment)

/**
 * `value` checked by `tap`'s schema: its output, or the first issue as `<path>: <message>`, the path `(root)` for the
 * value as a whole. Throws a TypeError for a schema that validates asynchronously: a tap's payload is checked inline.
 */
export function checkTapPayload(tap: TapDefinition, value: unknown): ReturnType<TapCheck> {
	const result = tap.schema["~standard"].validate(value)
	if (result instanceof Promise) {
		throw new TypeError(
			`tap ${tap.name}: its schema validates asynchronously; a tap's schema must validate synchronously`,
		)
	}
	if (result.issues === undefined) return { value: result.value }
	/* any defined issues fail, even an empty list */
	const [first] = result.issues
	return { issue: `${first?.path?.map(keyOf).join(".") || "(root)"}: ${first?.message ?? "invalid"}` }
}
