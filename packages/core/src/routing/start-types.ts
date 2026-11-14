/**
 * What `app.get(path)` and the other route starters return: the builder chain at its start, seeded from the app
 * handle's own type.
 */
import type { ApplyScoped, InitAccMeta, ScopedMwEntry } from "./app-types.ts"
import type { HttpApp } from "./app.ts"
import type { BuilderChain } from "./route-builder.ts"
import type { MergePath, ParamsFromPath } from "./types.ts"

/** The builder `app.get(path)` starts, from the app handle's own type. */
export type StartOf<H, TPath extends string, TMethod extends string> =
	H extends HttpApp<
		infer TEnv,
		infer TCtx,
		infer TRoutes,
		infer TMeta,
		infer TFactory,
		infer TDefaults extends string,
		infer TBase extends string,
		infer TScoped extends readonly ScopedMwEntry[]
	>
		? BuilderChain<{
				/** Starts from the meta the app declared, or `{}` when it declared none. */
				accMeta: InitAccMeta<TMeta>
				/** The app's ctx. */
				baseCtx: TCtx
				/** The app's base path. */
				basePath: TBase
				/** The app's ctx plus what middleware scoped to this path adds. */
				ctx: TCtx & ApplyScoped<TScoped, MergePath<TBase, TPath>>
				/** The app's default error keys. */
				defaultErrors: TDefaults
				/** The app's environment type. */
				env: TEnv
				/** The app's error factory. */
				errorFactory: TFactory
				/** No keys declared yet. */
				errorKeys: never
				/** No `.input()` yet. */
				input: never
				/** The meta type the app declared. */
				meta: TMeta
				/** No `.output()` yet. */
				output: never
				/** The path's params, strings. */
				params: ParamsFromPath<MergePath<TBase, TPath>>
				/** No client input yet. */
				request: {}
				/** The route's HTTP method, or a union of them for `app.on()`. */
				method: TMethod
				/** The route's full path, base path included. */
				path: MergePath<TBase, TPath>
				/** The routes the app has so far. */
				routes: TRoutes
				/** The app's path-scoped middleware. */
				scopedMw: TScoped
				/** No one-shot method called yet. */
				used: never
			}>
		: never
