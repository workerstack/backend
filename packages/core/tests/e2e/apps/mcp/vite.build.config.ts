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
	plugins: [
		...(base.plugins ?? []),
		createBuildPlugin(
			/* a Worker's own module (uploads-store.workers.ts reads its bindings there), provided at run time */
			{
				external: ["cloudflare:workers"],
				minify: true,
				outDir: "dist/workers",
				target: "workers",
			},
			{ entry: "src/serve-entry.workers.ts", export: "app" },
		),
	],
}
