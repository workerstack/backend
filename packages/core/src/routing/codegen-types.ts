/**
 * The types an app's generated `_gen/types.gen.d.ts` meets core through. `HttpCodegen` is empty until codegen
 * augments it with the app's operations, so an ungenerated app keeps plain string ids and `HttpContext`. Type-only.
 */
import type { HttpContext } from "../context/context.ts"
import type { ApplyOutput } from "./output-types.ts"

/**
 * Augmented by the generated types: `operationId` maps every declared operationId to its entry,
 * `{ operationId: { "users.list": { kind: "http"; ctx: … }; "rooms.connect": { kind: "ws"; ctx: … } } }`.
 */
export interface HttpCodegen {}

/** One declared operation: an HTTP route or a WebSocket one, and the context its handler receives. */
export type OperationEntry = { readonly kind: "http" | "ws"; readonly ctx: unknown }

/** The `operationId` map codegen `C` declares; `never` when it declares none. */
type OperationMapOf<C> = C extends { operationId: infer M } ? M : never

/** The operationIds codegen `C` declares; any string when it declares none. */
export type OperationIdOf<C> = [OperationMapOf<C>] extends [never] ? string : keyof OperationMapOf<C> & string

/** The HTTP operationIds codegen `C` declares, the ones `invalidate` takes; any string when it declares none. */
export type HttpOperationIdOf<C> = [OperationMapOf<C>] extends [never]
	? string
	: {
			[K in keyof OperationMapOf<C>]: OperationMapOf<C>[K] extends { kind: "http" } ? K : never
		}[keyof OperationMapOf<C>] &
			string

/** True when `T` names more than one id. */
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

/** True when `A` and `B` are the same type, not just assignable both ways. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** True when every pair of `U`'s members types `K` identically. */
type AllSame<U, K extends keyof U, V extends U = U> = false extends (
	U extends unknown ? (V extends unknown ? Same<U[K], V[K]> : never) : never
)
	? false
	: true

/** What one handler answers or reads of its own request: no shared step can know it for several routes. */
type RequestSpecific = "errors" | "input" | "meta" | "params" | "req" | "res" | "routePattern"

/** Each entry's context, distributed over a union of entries. */
type CtxOf<E> = E extends { readonly ctx: infer X } ? X : never

/** Each context's `errors`, distributed over a union of contexts. */
type ErrorsOf<U> = U extends { readonly errors: infer E } ? E : never

/**
 * Several routes' contexts as one: each key every member has with one type, the request-specific ones left out, and
 * the errors every member declares. Mapped over `Extract<keyof U, PropertyKey>`, so it does not distribute over `U`.
 */
type MergedCtx<U> = {
	[
		K in Extract<keyof U, PropertyKey> as K extends RequestSpecific ? never : AllSame<U, K> extends true ? K : never
	]: U[K]
} & {
	/** the error factories every route declares */
	readonly errors: { readonly [K in keyof ErrorsOf<U>]: ErrorsOf<U>[K] }
}

/**
 * The context of operation `Id` under codegen `C`: that route's own for one id, the merged context for several, and
 * `HttpContext` when `C` declares no operations.
 */
export type OperationCtxOf<C, Id extends OperationIdOf<C>> = [OperationMapOf<C>] extends [never]
	? HttpContext
	: IsUnion<Id> extends true
		? MergedCtx<CtxOf<OperationMapOf<C>[Id & keyof OperationMapOf<C>]>>
		: CtxOf<OperationMapOf<C>[Id & keyof OperationMapOf<C>]>

/** One of the app's operationIds once codegen ran, any string before. */
export type OperationId = OperationIdOf<HttpCodegen>

/** An `invalidate` target: one of the app's HTTP operationIds once codegen ran, any string before. */
export type HttpOperationId = HttpOperationIdOf<HttpCodegen>

/** The context a step shared by the routes `Id` names receives; see `OperationCtxOf`. */
export type OperationCtx<Id extends OperationId> = OperationCtxOf<HttpCodegen, Id>

/** A route ctx with `ctx.res` narrowed to what the route declares: the generated `Routes` ctx types. */
export type WithOutput<TCtx, TOutput> = ApplyOutput<TCtx, TOutput>
