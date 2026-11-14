/**
 * `@workerstack/backend`: the app (`httpApp()`), its context, errors, middleware and responses, the tree merge, and the
 * types an app is read through. Everything optional is its own subpath; nothing here registers itself (H23).
 */
export { HttpContext } from "./context/context.ts"
export type { CookieOptions } from "./context/cookie.ts"
export { HttpError } from "./errors/error.ts"
export { defineErrors, ERROR_META, type ErrorMetaEntry } from "./errors/errors.ts"
export type { ErrorFormatter, PayloadErrorFormatter } from "./errors/projector.ts"
export type { InferInputMap } from "./input/input.ts"
export type {
	HttpMetaSpec,
	MetaSpecConfig,
	MetaSpecContext,
	MetaSpecEntry,
	MetaSpecExpand,
	MetaSpecMergeConflict,
	MetaSpecProfile,
	MetaSpecSchemaEntry,
	MetaSpecSchemaSearch,
	MetaSpecSchemaSource,
	MetaSpecSingle,
	MetaSpecStrictness,
} from "./meta/meta-spec-merge.ts"
export { createMiddleware, type MiddlewareFn, type MiddlewareOptions } from "./middleware/middleware.ts"
export type { ProxyConfig } from "./proxy/proxy.ts"
export type { RealtimeBus } from "./realtime/bus.ts"
export type { ConnContext, RealtimeLimits } from "./realtime/route.ts"
export type { RealtimePublisher } from "./realtime/server.ts"
export { HttpRes, type ResponseOptions, type TypedResponse } from "./response/response.ts"
export type { SSEEvent, SSEOptions, SSEStream } from "./response/sse.ts"
export type { StatusKey } from "./response/status.ts"
export { HttpApp, httpApp } from "./routing/app.ts"
export { definePreset, HttpPreset } from "./routing/preset.ts"
export type {
	ComputeErrorsByStatus,
	HttpCtx,
	HttpMeta,
	InferBasePath,
	InferCtx,
	InferEnv,
	InferErrorFactory,
	InferMeta,
	InferMethods,
	InferRouteCtx,
	InferRouteErrors,
	InferRouteInput,
	InferRouteMeta,
	InferRouteMethods,
	InferRouteOutput,
	InferRoutePaths,
	InferRoutes,
	RouteRecord,
} from "./routing/app-types.ts"
export type { HttpCodegen, HttpOperationId, OperationCtx, OperationId, WithOutput } from "./routing/codegen-types.ts"
export type { OutputOptions, HttpProjection, HttpSelection } from "./routing/output-types.ts"
export type { TapContext, TapHandler } from "./routing/tap.ts"
export { mergeTree } from "./routing/tree-merge.ts"
export type { MergePath, PrefixRoutes } from "./routing/types.ts"
export type { InferOutput, StandardSchemaLike } from "./validation/standard-schema.ts"
export type { WSAdapter, WSContext, WSHandler } from "./ws/contract.ts"
export type { WSOriginPolicy } from "./ws/origin.ts"
export type { WSAdapterOptions } from "./ws/shared.ts"
