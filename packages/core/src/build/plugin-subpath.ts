/**
 * `@workerstack/backend/plugin`: `backendPlugin()`, the Vite plugin, and its config types. The generation runner the CLI shares
 * with it stays internal.
 */
export {
	type BackendCodegenConfig,
	type OpenApiOutputConfig,
	type BackendPlugin,
	type BackendPluginConfig,
	backendPlugin,
} from "./plugin.ts"
