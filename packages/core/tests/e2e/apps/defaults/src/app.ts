import type { WSAdapter } from "@workerstack/backend/http"
import type { RouteTree } from "@workerstack/backend/http/tree"
import { httpApp } from "@workerstack/backend/http"
import { serveManifest, serveOpenApi } from "@workerstack/backend/http/openapi"
import { scalar } from "@workerstack/backend/http/openapi/scalar"
import * as z from "zod"

/** `routeTree`: boot from a generated route tree (`src/_gen/routes.gen.ts`) instead of building the trie. */
export type AppOptions = { routeTree?: RouteTree }

/** No basePath, no CORS, no i18n, default trailingSlash ("ignore"). */
export function createApp(wsAdapter?: WSAdapter, options?: AppOptions) {
	const app = options?.routeTree ? httpApp().routeTree(options.routeTree) : httpApp()
	if (wsAdapter) app.wsAdapter(wsAdapter)

	const routed = app
		.get("/health")
		.meta({ operationId: "health.list" })
		.handler((ctx) => ctx.res.text("ok", "ok"))
		.get("/users/:id")
		.meta({ operationId: "users.retrieve" })
		.handler((ctx) => ctx.res.json("ok", { id: ctx.params.id }))
		.post("/echo")
		.meta({ operationId: "echo.create" })
		.output({ "application/json": { created: z.string() } })
		.handler(async (ctx) => {
			const body = await ctx.req.text()
			return ctx.res.json("created", body)
		})
	return serveManifest(serveOpenApi(routed, { docs: { "/docs": scalar }, title: "Backend Defaults", version: "0.0.1" }))
}
