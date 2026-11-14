/** The app each build target bundles and serves: a health route and its OpenAPI document. */
import { serveOpenApi } from "../../../src/openapi/register.ts"
import { httpApp } from "../../../src/routing/app.ts"

export const app = serveOpenApi(
	httpApp()
		.get("/health")
		.handler((ctx) => ctx.res.text("ok", "ok")),
	{ title: "Build Fixture", version: "1.0.0" },
)
