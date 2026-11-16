---
description: The build plugin and the CLI
order: 220
---

# The build plugin and the backend CLI

The Vite plugin writes the app's artifacts — the route tree, the types, the manifest, the OpenAPI document and the
MCP handler — at build start, and again on each save in dev:

```ts
import { backendPlugin } from "@workerstack/backend/plugin"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [backendPlugin({ app: "src/app.ts" })],
})
```

What it generates is `codegen`, and each output takes a path or a config of its own:

```ts
import { backendPlugin } from "@workerstack/backend/plugin"

export default {
	plugins: [
		backendPlugin({
			app: "src/app.ts",
			codegen: {
				manifest: true,
				mcp: true,
				openApi: {
					security: ["apiKey"],
					servers: [{ url: "https://api.example.com" }],
					title: "Shop",
					version: "1.0.0",
				},
				securitySchemes: { apiKey: { in: "header", name: "Authorization", type: "apiKey" } },
				tree: true,
				types: { baseCtxName: "AppCtx" },
			},
			watch: ["src/**/*.ts"],
		}),
	],
}
```

`@workerstack/backend/build` adds the production bundle for a deploy target, so `vite build` emits one file to run:

```ts
import { createBuildPlugin } from "@workerstack/backend/build"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [createBuildPlugin({ target: "workers", minify: true }, { entry: "src/app.ts", export: "app" })],
})
```

The `backend` CLI does the same generation without Vite, which is what a CI step or a `package.json` script wants:

```sh
backend generate                       # reads vite.config.* and the backendPlugin() in it
backend generate --app src/app.ts --tree --types --manifest
backend generate --config vite.config.ts --plugin 0 --watch
backend generate --merge-tree src/_gen/routes.gen.ts   # a gateway's merged tree
backend init --force
```

| Flag                  | What it does                                                                       |
| --------------------- | ---------------------------------------------------------------------------------- |
| `--config <path>`     | the Vite config holding `backendPlugin()` (default: `vite.config.{ts,mts,js,mjs}`) |
| `--plugin <n>`        | which `backendPlugin()` in the config, 0-based                                     |
| `--app <path>`        | the app entry; overrides the config's app, or replaces the config                  |
| `--tree`              | the route tree module                                                              |
| `--types`             | the ambient types                                                                  |
| `--manifest`          | the route manifest                                                                 |
| `--merge-tree <path>` | the route tree source of a gateway                                                 |
| `--watch`             | generate again when files next to the app change                                   |

The SDKs, the CLI and the MCP server are clients': `clients generate --app <path>`.

Full reference: [the build plugin](https://github.com/workerstack/backend/blob/main/docs/plugin.md).
