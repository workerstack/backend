---
description: The app and its handles
order: 40
---

# The app

`httpApp<TEnv>()` returns an app typed to its runtime environment — a Worker's bindings, or whatever your adapter
passes. The chain derives handles that share one settings graph: `basePath()` rebases every route registered through
it, `context()` adds static values the handler finds on `ctx`, and `use()` installs middleware for that handle and
its descendants.

```ts
import { httpApp } from "@workerstack/backend/http"

type Env = { GREETING: string }

const app = httpApp<Env>().basePath("/api").context({ startedAt: Date.now() })

app.get("/hello").handler((ctx) => ctx.res.json("ok", { greeting: ctx.env.GREETING, since: ctx.startedAt }))

export default app
```

`context()` values are fixed at registration; per-request data belongs in middleware, which passes it through
`next({ … })`.

Settings sit on the same chain and apply to the whole app:

```ts
import { httpApp } from "@workerstack/backend/http"

const app = httpApp()
	.trailingSlash("strip")
	.encodedSlashes("reject")
	.errorFormat("problem+json")
	.onNotFound((ctx) => new Response(`no route for ${new URL(ctx.req.url).pathname}`, { status: 404 }))
	.onMethodNotAllowed((ctx) => new Response(null, { headers: { allow: ctx.allowed.join(", ") }, status: 405 }))

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))
```

| Setting                                          | What it does                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `basePath(prefix)`                               | rebases every route and OpenAPI path registered through the handle     |
| `context(values)`                                | static values on `ctx`, typed into the handler                         |
| `use(mw)` / `use(path, mw)`                      | middleware for this handle and its descendants, or for one path        |
| `route(prefix, sub)`                             | mounts a sub-app under a prefix                                        |
| `meta(values)`                                   | app-level route meta every route inherits                              |
| `errorFactory(factory)`, `defaultErrors(…)`      | the error factory routes throw from, and the keys every route declares |
| `defaultBoundary(key)`                           | the error an unexpected throw becomes                                  |
| `onError(handler)`                               | maps a thrown value to a response before error telemetry               |
| `onNotFound(handler)`, `onMethodNotAllowed(…)`   | the two misses                                                         |
| `logger(logger \| false)`, `requestLog(…)`       | where lines go, and the one-line-per-request log                       |
| `telemetry(value)`                               | the tracing adapter (`otelAdapter`)                                    |
| `errorFormat(format)`                            | `"backend"` (the default) or `"problem+json"` (RFC 9457)               |
| `defaultErrorFormatter`, `payloadErrorFormatter` | your own error body, schema-checked                                    |
| `trailingSlash`, `encodedSlashes`, `stripPrefix` | path normalization, and the prefix a gateway already consumed          |
| `wsAdapter(adapter)`                             | the WebSocket adapter (`workersWebSocket()`)                           |
| `fetch(request, env, ctx)`                       | the Fetch handler an adapter calls                                     |

Apps that share their settings write them once with `definePreset<TEnv>()`, which takes the same setters and
`use(mw)`. `httpApp(preset)` starts an app with its own copy, typed as the same chain on `httpApp()` would be:

```ts
import { defineErrors, definePreset, httpApp } from "@workerstack/backend/http"
import { requestId } from "@workerstack/backend/http/request-id"

const errors = defineErrors({ internal_server_error: "internal_server_error" })

export const platform = definePreset<{ REGION: string }>()
	.errorFactory(errors)
	.defaultBoundary("internal_server_error")
	.requestLog(true)
	.use(requestId())

const app = httpApp(platform)

app.get("/id").handler((ctx) => ctx.res.json("ok", { id: ctx.requestId }))
```

Full reference: [the app](https://github.com/workerstack/backend/blob/main/docs/app-settings.md).
