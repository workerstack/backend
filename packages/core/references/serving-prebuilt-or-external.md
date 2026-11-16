---
description: Serving a prebuilt document
order: 170
---

# Serving a prebuilt or external document

`serveStaticOpenApi(app, options)` from `@workerstack/backend/http/openapi/static` serves a document someone has already
built. Nothing generates it, so the generator never reaches the bundle: an app that serves its document this way
carries about 1.2 KB gzipped over a bare `httpApp()`. Reach for it when the build plugin already wrote the document to
disk, when a gateway serves a document assembled elsewhere, or when a Worker should answer the spec without parsing
571 KB of it on every cold start. Reach for `serveOpenApi` instead when the running app's own routes are the
document, which is the usual case.

The source is an inline value, a Workers asset binding, a URL, or a loader of your own:

```ts
import { httpApp } from "@workerstack/backend/http"
import { scalar } from "@workerstack/backend/http/openapi/scalar"
import { serveStaticOpenApi } from "@workerstack/backend/http/openapi/static"

/* a document you already have as a value: serialized once, on the first request */
const inline = serveStaticOpenApi(httpApp(), {
	json: { inline: { info: { title: "Shop", version: "1.2.0" }, openapi: "3.2.1", paths: {} } },
})

/* a Workers assets binding: env.ASSETS.fetch on the request's own origin */
const onWorkers = serveStaticOpenApi(httpApp(), {
	docs: { "/docs": scalar },
	json: { asset: "/openapi.json" },
	yaml: { asset: "/openapi.yaml" },
})

/* someone else's document, with a cache-control of its own */
const upstream = serveStaticOpenApi(httpApp(), {
	cacheControl: "public, s-maxage=3600, stale-while-revalidate=86400",
	json: { url: "https://specs.example.com/v1/openapi.json" },
})

/* your own loader: whatever it returns is the document, a Response read once */
const loaded = serveStaticOpenApi(httpApp(), {
	json: async (ctx) => await (ctx.env as { SPECS: { get(key: string): Promise<string> } }).SPECS.get("openapi"),
	jsonPath: "/v1/openapi/spec",
})
```

`docs` takes the imported page here exactly as it does in `serveOpenApi`, so neither function bundles a page it does
not show. The JSON route is `${path}.json` (`path` is `/openapi` by default), the YAML routes `.yaml` and `.yml`
appear only with a `yaml` source, and `jsonPath` or `yamlPath` replaces the stem outright. Every route is internal,
so the document never documents its own endpoints, and `meta` rides along under that marking on every route the call
mounts, the docs pages included. It takes what a route's own `.meta()` takes on that handle: backend's keys (a
`security` scheme, a `summary`) and the ones the app declared with `metaType<T>()`, so an app whose middleware turns
`meta.cacheControl` into the header passes it here. `serveOpenApi` and `serveManifest` take the same `meta`.

No copy script is needed to put the bytes where a Worker can read them: point the build plugin's output at the
assets directory wrangler serves, and codegen writes both files there on every generate.

```ts
import { backendPlugin } from "@workerstack/backend/plugin"

export default {
	plugins: [
		backendPlugin({
			app: "src/app.ts",
			codegen: { openApi: { path: "assets/openapi.json", title: "Shop", version: "1.2.0" } },
		}),
	],
}
```

A document is loaded once per process or isolate and kept with its ETag — the upstream's strong `etag` when it sent
one, else backend's own SHA-256 tag — and concurrent first requests share that one load. A load that failed is not
kept, so the next request tries again, but a load that succeeded is never refreshed: a long-lived isolate
serving a `url` source keeps the document it first fetched until it restarts or redeploys. A failing asset,
an unbound binding and a failing loader are a 500; a URL that fails or answers non-2xx is a 502.

Full reference: [the OpenAPI document](https://github.com/workerstack/backend/blob/main/docs/openapi.md).
