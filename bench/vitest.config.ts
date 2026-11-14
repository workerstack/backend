import { defaultClientConditions, defaultServerConditions } from "vite"
import { defineConfig } from "vitest/config"

/* a side's backend is a core source tree, read as a checkout reads it (backend-source): its `#output-check` import
 * resolves to that tree's src/, never to a dist/ a checkout does not build */
export default defineConfig({
	resolve: { conditions: ["backend-source", ...defaultClientConditions] },
	ssr: { resolve: { conditions: ["backend-source", ...defaultServerConditions.filter((c) => c !== "module")] } },
})
