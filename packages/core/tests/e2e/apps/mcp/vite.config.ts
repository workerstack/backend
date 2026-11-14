import { backendPlugin } from "@workerstack/backend/plugin"

/* Acme's public scheme: an API key in Authorization, its prefix in the description */
const apiKey = {
	description: "API key authentication. Format: ApiKey {your_api_key}",
	in: "header",
	name: "Authorization",
	type: "apiKey",
}

export default {
	plugins: [
		backendPlugin({
			app: "src/gen-app.ts",
			codegen: {
				mcp: true,
				openApi: { title: "Backend MCP", version: "1.0.0" },
				securitySchemes: { apiKey },
				tree: true,
			},
		}),
	],
}
