import { createBuildPlugin } from "@workerstack/backend/build"
import { defaultClientConditions, defaultServerConditions } from "vite"
import base from "./vite.config.ts"

/* the app's own config supplies honey() codegen — the build goes through the real path */
export default {
	...base,
	logLevel: "error",
	/* in this checkout core is read as source: honey-source, as every repo consumer resolves it (R3) */
	resolve: { conditions: ["honey-source", ...defaultClientConditions] },
	ssr: { resolve: { conditions: ["honey-source", ...defaultServerConditions] } },
	/* only a built bundle carries it: what /api/served-from reports (workerd has no import.meta.url) */
	define: { "import.meta.env.HONEY_BUNDLE": "true" },
	plugins: [
		...(base.plugins ?? []),
		createBuildPlugin(
			{ minify: true, outDir: "dist/workers", target: "workers" },
			{ entry: "src/serve-entry.workers.ts", export: "app" },
		),
	],
}
