import type { OperationCtx } from "@workerstack/backend/http"

type SearchCtx = OperationCtx<"input.search">

/**
 * A service typed by the route's operationId, called with the handler's own ctx (bit 22 a): the shape a consumer
 * writes when its services live outside the app module, where reading the ctx off `typeof app` would be a circular
 * import. The generated slot types the id, so it must accept what the handler has.
 */
export const SearchService = {
	run(ctx: SearchCtx): { auth: SearchCtx["meta"]["auth"]; page: number } {
		return { auth: ctx.meta.auth, page: ctx.input.search.page }
	},
}
