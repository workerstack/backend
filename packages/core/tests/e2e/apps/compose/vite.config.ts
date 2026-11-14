import { backendPlugin } from "@workerstack/backend/plugin"

export default {
	plugins: [
		backendPlugin({
			app: "src/gen-app.ts",
			codegen: {
				manifest: true,
				openApi: { title: "Backend Compose", version: "0.0.1" },
				tree: true,
				types: true,
			},
		}),
	],
}
