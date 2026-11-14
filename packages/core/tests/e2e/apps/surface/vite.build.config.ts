import { createBuildPlugin } from "@workerstack/backend/build"
import { defaultClientConditions, defaultServerConditions } from "vite"
import base from "./vite.config.ts"

/* the app's own config supplies httpApp() codegen — the build goes through the real path */
export default {
	...base,
	logLevel: "error",
	/* in this checkout core is read as source: backend-source, as every repo consumer resolves it (R3) */
	resolve: { conditions: ["backend-source", ...defaultClientConditions] },
	ssr: { resolve: { conditions: ["backend-source", ...defaultServerConditions] } },
	plugins: [
		...(base.plugins ?? []),
		createBuildPlugin(
			{ minify: true, outDir: "dist/workers", target: "workers" },
			{ entry: "src/serve-entry.workers.ts", export: "app" },
		),
	],
}
