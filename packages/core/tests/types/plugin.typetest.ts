/**
 * backendPlugin()'s options, as typed: `outputValidation: true` keeps the answer check in a Vite production build.
 * Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import { backendPlugin, type BackendPluginConfig } from "../../src/build/plugin.ts"

describe("backendPlugin({ outputValidation })", () => {
	it("takes a boolean, and no mode string", () => {
		expectTypeOf<BackendPluginConfig["outputValidation"]>().toEqualTypeOf<boolean | undefined>()
		backendPlugin({ app: "src/app.ts", outputValidation: true })
		// @ts-expect-error: the plugin keeps or drops the check; the app's old "always" | "dev" | "off" modes are gone
		backendPlugin({ app: "src/app.ts", outputValidation: "always" })
	})
})
