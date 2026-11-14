import { backendPlugin } from "@workerstack/backend/plugin"

export default {
	plugins: [
		backendPlugin({
			app: "src/gen-app.ts",
			codegen: {
				manifest: true,
				openApi: { title: "Backend Surface", version: "1.0.0" },
				tree: true,
				types: true,
			},
		}),
	],
}
