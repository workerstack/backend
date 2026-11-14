# @workerstack/backend

A typed web framework for the Fetch API whose routes are the source of its clients. You write a route once, with its
input and output schemas; backend runs it on Cloudflare Workers, and
[`@workerstack/clients`](https://www.npmjs.com/package/@workerstack/clients) turns the same routes into an
OpenAPI 3.1 document, typed SDKs for six languages, a command-line client and an MCP server.

Nothing is inferred at runtime: the schemas you declare are what the handler receives, what the document says, and
what every generated client's types promise.

This page is the whole framework. Every TypeScript block below is type-checked by the repository's tests against this
package, so nothing here is pseudocode.

- [Install](#install)
- [A route, end to end](#a-route-end-to-end)
- [The app](#the-app)
- [Routing](#routing)
- [Input and output](#input-and-output)
- [Responses](#responses)
- [Errors](#errors)
- [Middleware](#middleware)
- [The request context](#the-request-context)
- [Cookies](#cookies)
- [Streaming, WebSockets and realtime](#streaming-websockets-and-realtime)
- [Running on Cloudflare Workers](#running-on-cloudflare-workers)
- [Static files and proxying](#static-files-and-proxying)
- [The OpenAPI document](#the-openapi-document)
- [Serving a prebuilt or external document](#serving-a-prebuilt-or-external-document)
- [The MCP server](#the-mcp-server)
- [Logging and tracing](#logging-and-tracing)
- [Internationalization and crypto](#internationalization-and-crypto)
- [Testing](#testing)
- [The build plugin and the backend CLI](#the-build-plugin-and-the-backend-cli)
- [Generated clients](#generated-clients)
- [Every export](#every-export)
- [Type helpers](#type-helpers)
- [Documentation](#documentation)
- [License](#license)

## Install

backend moved to the workerstack org in 1.0.0-rc.23, and [the migration note](https://github.com/workerstack/backend/blob/main/docs/migrating-from-honey.md)
maps each old package name to its new one. 1.0 is out as a release candidate, published under npm's `next` tag, so
an install without a tag gets a deprecated placeholder.
Add `@next` until the final release:

```sh
npm install @workerstack/backend@next
npx --package @workerstack/backend backend init
```

Apps run on Cloudflare Workers; the tooling needs Node 22.12 or later or Bun 1.3 or later. A schema library is yours to pick: backend validates
through [Standard Schema](https://standardschema.dev), so Zod, Valibot, ArkType, Effect Schema and Yup all work. The
examples here use Zod.

`backend init` writes `src/app.ts`, a Worker entry in `src/worker.ts`, a `wrangler.jsonc` and a Vite config;
`npm run dev` runs it with `wrangler dev`.

## A route, end to end

Declare what a route takes and what it answers. `ctx.input` is typed by the schemas, and so is `ctx.res.json`'s
payload for the status key you name:

```ts
import { defineErrors, httpApp } from "@workerstack/backend/http"
import * as z from "zod"

const errors = defineErrors({ not_found: "not_found" })

const app = httpApp()

app
	.get("/books/:id")
	.input({ search: z.object({ lang: z.string().optional() }) })
	.output({ "application/json": { ok: z.object({ id: z.string(), title: z.string() }) } })
	.errors(errors, "not_found")
	.handler((ctx) => {
		if (ctx.params.id === "0") throw errors.not_found()
		return ctx.res.json("ok", { id: ctx.params.id, title: "Dune" })
	})

app
	.post("/books")
	.input({ json: z.object({ title: z.string().min(1) }) })
	.handler((ctx) => ctx.res.json("created", { id: "b-1", title: ctx.input.json.title }))

export default app
```

The reference UI comes from the document the routes already describe:

```ts
import { httpApp } from "@workerstack/backend/http"
import { serveOpenApi } from "@workerstack/backend/http/openapi"
import { scalar } from "@workerstack/backend/http/openapi/scalar"

const app = httpApp()
app.get("/health").handler((ctx) => ctx.res.text("ok", "ok"))

export default serveOpenApi(app, { docs: { "/docs": scalar }, title: "Books", version: "1.0.0" })
```

```sh
npx wrangler dev
curl http://127.0.0.1:8787/health
# ok
# the API reference: open http://127.0.0.1:8787/docs
```

Then generate a client from the app module itself, with no document to keep in step by hand:

```sh
npx --package @workerstack/clients clients generate --app src/app.ts --target ts --out generated
```

## The app

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

## Routing

One method per call (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`), `all` for any, and `on` for a named
set. Paths take `:params` and a trailing `*` wildcard; `meta()` carries what the document says about the route.

```ts
import { httpApp } from "@workerstack/backend/http"
import { serveOpenApi } from "@workerstack/backend/http/openapi"
import { scalar } from "@workerstack/backend/http/openapi/scalar"

const app = httpApp()

app
	.get("/users/:id")
	.meta({ operationId: "users.get", summary: "One user", tags: ["users"] })
	.handler((ctx) => ctx.res.json("ok", { id: ctx.params.id }))

app.delete("/users/:id").handler((ctx) => ctx.res.noContent())

serveOpenApi(app, { title: "Users", version: "1.0.0", docs: { "/docs": scalar } })
```

Sub-apps mount with `route()`, and `on()` registers one handler for several methods:

```ts
import { httpApp } from "@workerstack/backend/http"

const admin = httpApp()
admin.get("/stats").handler((ctx) => ctx.res.json("ok", { users: 1 }))

const app = httpApp()
app.route("/admin", admin)
app.on(["POST", "PUT"], "/webhooks/:source").handler((ctx) => ctx.res.json("accepted", { from: ctx.params.source }))
```

A gateway merges the route trees its services publish, each tree tagged with meta of its own:

```ts
import { mergeTree } from "@workerstack/backend/http"
import type { RouteTree } from "@workerstack/backend/http/tree"

declare const orders: RouteTree
declare const billing: RouteTree

const gateway = mergeTree([orders, { service: "orders" }], [billing, { service: "billing" }])
```

Full reference: [routing](https://github.com/workerstack/backend/blob/main/docs/routing.md).

## Input and output

`.input()` validates the request: `params`, `search`, `headers`, `json`, `form` and `text`, each a Standard Schema.
`.output()` declares what the route answers: its bodies by media type and 2xx status key, its 3xx statuses under
`redirect`, a 204 as `no_content: true`, and the response headers of a 2xx or 3xx status. An error answer is declared
with `.errors()`, and a key the route cannot answer is a type error naming the key and where it goes. Each answer is
checked against the declaration, except in a production `vite build` through `backendPlugin()`, which drops the check
unless `backendPlugin({ outputValidation: true })` keeps it. A media type other than JSON is just another key, so an
image or a CSV is as typed as a JSON body:

```ts
import { httpApp } from "@workerstack/backend/http"
import * as z from "zod"

const app = httpApp()

app
	.get("/avatar/:id")
	.output({
		"image/png": { ok: z.instanceof(Uint8Array) },
		headers: { ok: z.object({ etag: z.string() }) },
	})
	.handler((ctx) =>
		ctx.res.binary("ok", new Uint8Array([137, 80, 78, 71]), { contentType: "image/png", headers: { etag: '"v1"' } }),
	)
```

A body you do not want in memory is input too: `streamed()` leaves a json or form body unread for the handler to stream.

```ts
import { httpApp } from "@workerstack/backend/http"
import { streamed } from "@workerstack/backend/http/input"
import * as z from "zod"

const app = httpApp()

app
	.post("/ingest")
	.input({ json: streamed(z.object({ chunks: z.number(), fileName: z.string() })) })
	.handler(async (ctx) => {
		/* the schema is what the document and the clients promise; the body itself stays on the request */
		const reader = (ctx.req.body as ReadableStream<Uint8Array>).getReader()
		await reader.cancel()
		return ctx.res.json("accepted", { taken: true })
	})
```

Content negotiation, when a route answers in more than one shape, reads the request directly:

```ts
import { accepts } from "@workerstack/backend/http/accepts"
import { httpApp } from "@workerstack/backend/http"

const app = httpApp()

app.get("/report").handler((ctx) => {
	const type = accepts(ctx.req, ["text/csv", "application/json"])
	if (type === "text/csv") return ctx.res.csv("ok", "name,count\nada,1\n")
	return ctx.res.json("ok", [{ count: 1, name: "ada" }])
})
```

Full reference: [input and output](https://github.com/workerstack/backend/blob/main/docs/input-output.md).

## Responses

`ctx.res` builds a typed response: `json`, `text`, `html`, `xml`, `csv`, `binary`, `noContent`, `redirect`, `raw` for
a `Response` you made yourself, and `sse`, `stream` and `generate` for bodies that arrive over time. The first
argument is the status key the route declared, which is what makes the payload's type the right one. On a route with
`.output()`, each helper takes only the status keys it declares: `noContent` needs a declared `no_content`, `redirect` a
`redirect` entry, an undeclared media type's helper is gone, and so is `raw`.

```ts
import { httpApp } from "@workerstack/backend/http"

const app = httpApp()

app.get("/page").handler((ctx) => ctx.res.html("ok", "<h1>hi</h1>"))
app.get("/feed").handler((ctx) => ctx.res.xml("ok", "<feed />"))
app.get("/old").handler((ctx) => ctx.res.redirect("found", "/new"))
app.get("/nothing").handler((ctx) => ctx.res.noContent())
app.get("/bytes").handler((ctx) =>
	ctx.res.stream(async (writable) => {
		const writer = writable.getWriter()
		await writer.write(new TextEncoder().encode("chunk"))
		await writer.close()
	}),
)
```

Caching, entity tags and byte ranges are middleware and helpers over any of those:

```ts
import { httpApp } from "@workerstack/backend/http"
import { cacheControl } from "@workerstack/backend/http/cache-control"
import { etag } from "@workerstack/backend/http/etag"
import { prettyJson } from "@workerstack/backend/http/pretty-json"
import { rangeResponse } from "@workerstack/backend/http/range"

const video = new Blob([new Uint8Array(1024)], { type: "video/mp4" })

const app = httpApp()
	.use(etag())
	.use(prettyJson({ query: "pretty" }))
	.use(cacheControl({ public: true, maxAge: 60, staleWhileRevalidate: 300 }))

app.get("/prices").handler((ctx) => ctx.res.json("ok", { eur: 1.08 }))
app.get("/video").handler((ctx) => ctx.res.raw(rangeResponse(ctx.req, video)))
```

`etag()` answers a conditional GET with 304, `rangeResponse` a `Range` request with 206, and `cacheControl` sets the
header once for every route under it. `httpDate` from the same subpath formats an HTTP date, and `notModified` from
`@workerstack/backend/http/etag` turns a response into its 304.

Streaming bodies clean up when the client leaves — the generator's `finally` runs:

```ts run
import { httpApp } from "@workerstack/backend/http"

let ended = (_: string) => {}
const cleanedUp = new Promise<string>((resolve) => (ended = resolve))

const app = httpApp()

app.get("/ticks").handler((ctx) =>
	ctx.res.sse(
		async (stream) => {
			try {
				for (let tick = 1; !stream.closed; tick++) {
					await stream.send({ data: String(tick), event: "tick", id: String(tick) })
					await new Promise((resolve) => setTimeout(resolve, 50))
				}
			} finally {
				stream.close()
				ended("cleaned up")
			}
		},
		{ defaultRetry: 3000 },
	),
)

const leave = new AbortController()
const response = await app.fetch(new Request("http://localhost/ticks", { signal: leave.signal }), {})
const reader = (response.body as ReadableStream<Uint8Array>).getReader()
const first = new TextDecoder().decode((await reader.read()).value)
console.log(first.includes("retry: 3000") ? "retry sent" : "no retry")
leave.abort()
console.log(await cleanedUp)
// prints: retry sent
// prints: cleaned up
```

Full reference: [streaming](https://github.com/workerstack/backend/blob/main/docs/streaming.md),
[media types](https://github.com/workerstack/backend/blob/main/docs/capabilities/media-types.md),
[range requests](https://github.com/workerstack/backend/blob/main/docs/capabilities/range.md) and
[Cache-Control](https://github.com/workerstack/backend/blob/main/docs/capabilities/cache-control.md).

## Errors

`defineErrors` maps your own keys to HTTP statuses and gives you the factory a route throws from. A route declares
which keys it can throw with `.errors()`, and those keys are what the document and every generated client know
about.

```ts
import { defineErrors, httpApp } from "@workerstack/backend/http"

const errors = defineErrors({ out_of_stock: "conflict" })

const app = httpApp().errorFormat("problem+json")

app
	.post("/orders")
	.errors(errors, "out_of_stock")
	.handler(() => {
		throw errors.out_of_stock()
	})
```

`errorFormat("problem+json")` answers RFC 9457 Problem Details instead of backend's own body. Anything thrown becomes a
`HttpError`; `onError` sees it first, and `ERROR_META` is the symbol a thrown value carries its status under, so a
value from elsewhere can present itself as one. Under either format, `defaultErrorFormatter` gets the default body (the
Problem Details document under `problem+json`) and its answer keeps that content type, while `payloadErrorFormatter`
shapes the body of an error `defineErrors` gave a payload schema, which always answers `application/json`.

```ts
import { defineErrors, ERROR_META, type ErrorFormatter, HttpError, httpApp } from "@workerstack/backend/http"

const errors = defineErrors({ db_timeout: "service_unavailable" })

/* the body an error answers with: the default shape, plus whatever your API adds to it */
const formatter: ErrorFormatter = (error, defaultShape) => ({ ...defaultShape, retriable: error.status >= 500 })

const app = httpApp()
	.errorFactory(errors)
	.errorFormat("problem+json")
	.defaultErrorFormatter(formatter)
	.onError((error, ctx) => {
		if (error instanceof HttpError && error.errorKey === "db_timeout") return ctx.jsonFromError(error)
		return undefined
	})

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))

/* a thrown value of your own, carrying the status backend should answer with */
const refusal = Object.assign(new Error("nope"), { [ERROR_META]: { errorKey: "forbidden", status: 403 } })
```

Full reference: [problem+json](https://github.com/workerstack/backend/blob/main/docs/capabilities/problem-json.md) and
[logging, errors and tracing](https://github.com/workerstack/backend/blob/main/docs/observability.md).

## Middleware

A middleware is a function of `(ctx, next)`. Calling `next({ … })` adds typed values to the context every route below
it sees — that is how per-request data (a user, a tenant, a database handle) reaches a handler without a global.

```ts
import { type MiddlewareFn, httpApp } from "@workerstack/backend/http"
import { cors } from "@workerstack/backend/http/cors"
import { rateLimit } from "@workerstack/backend/http/rate-limit"
import { secureHeaders } from "@workerstack/backend/http/secure-headers"

type UserCtx = { user: { id: string } | null }

const withUser: MiddlewareFn<{ req: Request }, UserCtx> = (ctx, next) => {
	const token = ctx.req.headers.get("authorization")
	return next({ user: token === null ? null : { id: "u1" } })
}

const app = httpApp()
	.use(secureHeaders())
	.use(cors({ origin: ["https://app.example.com"], credentials: true }))
	.use(rateLimit({ limit: 100, windowMs: 60_000 }))
	.use(withUser)

app.get("/me").handler((ctx) => ctx.res.json("ok", { user: ctx.user }))
```

`createMiddleware` infers what a middleware adds from every `next({...})` it calls. Its options name the errors it can
answer with (each route that mounts it declares them, and its document lists them) and the meta it gives those routes:

```ts
import { createMiddleware, defineErrors, httpApp } from "@workerstack/backend/http"

const errors = defineErrors({ api_key_missing: "unauthorized" })

const requireKey = createMiddleware(
	(ctx: { req: Request }, next) => {
		if (ctx.req.headers.get("x-api-key") === null) throw errors.api_key_missing()
		return next({ at: Date.now() })
	},
	{ errors: [errors, "api_key_missing"], meta: { security: "apiKey" } },
)

const app = httpApp().errorFactory(errors).use(requireKey)
app.get("/me").handler((ctx) => ctx.res.json("ok", { at: ctx.at }))
```

The bundled set, each its own subpath so an app that does not import it bundles none of it:

```ts
import { httpApp } from "@workerstack/backend/http"
import { bodyLimit } from "@workerstack/backend/http/body-limit"
import { compress } from "@workerstack/backend/http/compress"
import { csrf } from "@workerstack/backend/http/csrf"
import { ipRestrict } from "@workerstack/backend/http/ip-restrict"
import { poweredBy } from "@workerstack/backend/http/powered-by"
import { requestId } from "@workerstack/backend/http/request-id"
import { serverTiming } from "@workerstack/backend/http/server-timing"
import { timeout } from "@workerstack/backend/http/timeout"

const app = httpApp()
	.use(requestId())
	.use(poweredBy())
	.use(serverTiming())
	.use(timeout({ duration: 10_000 }))
	.use(bodyLimit({ maxSize: 1024 * 1024 }))
	.use(compress({ threshold: 2048 }))
	.use(csrf({ origin: ["https://app.example.com"] }))
	.use(ipRestrict({ allowList: ["203.0.113.0/24"] }))

app.get("/report").handler((ctx) => ctx.res.text("ok", "row\n".repeat(5000)))
```

| Middleware                              | From                                       | What it does                                                                              |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `cors(options)`                         | `@workerstack/backend/http/cors`           | the CORS headers and the preflight answer                                                 |
| `secureHeaders(options?)`               | `@workerstack/backend/http/secure-headers` | CSP, HSTS and the rest of the hardening headers                                           |
| `csrf(options?)`                        | `@workerstack/backend/http/csrf`           | refuses a cross-origin unsafe method                                                      |
| `rateLimit(options)`                    | `@workerstack/backend/http/rate-limit`     | a window per key, with `memoryRateLimitStore()` or one of your own                        |
| `compress(options?)`                    | `@workerstack/backend/http/compress`       | gzip or brotli over a threshold                                                           |
| `cacheControl(options)`                 | `@workerstack/backend/http/cache-control`  | the `Cache-Control` header, and `httpDate`                                                |
| `etag(options?)`                        | `@workerstack/backend/http/etag`           | an entity tag, 304 on a conditional GET, and `notModified`                                |
| `prettyJson(options?)`                  | `@workerstack/backend/http/pretty-json`    | indents a JSON body when the query asks                                                   |
| `requestId(options?)`                   | `@workerstack/backend/http/request-id`     | one id per request, on the response and in the log                                        |
| `timeout(options)`                      | `@workerstack/backend/http/timeout`        | a deadline per request                                                                    |
| `bodyLimit(options)`                    | `@workerstack/backend/http/body-limit`     | refuses a body over a size, or of a media type it does not list                           |
| `ipRestrict(options)`                   | `@workerstack/backend/http/jwt`            | `signJwt`, `verifyJwt`, `remoteJwks`, `decodeJwtPayload`, `importPkcs8`, `isJwsAlgorithm` |
| `@workerstack/backend/http/ip-restrict` | an allow or deny list over `ctx.ip`        |
| `ipAllowed(ip, lists)`                  | `@workerstack/backend/http/ip-restrict`    | the same check for lists read per request                                                 |
| `serverTiming()`                        | `@workerstack/backend/http/server-timing`  | `Server-Timing`, and `ctx.timing` to add to it                                            |
| `poweredBy(options?)`                   | `@workerstack/backend/http/powered-by`     | the `X-Powered-By` header                                                                 |
| `staticFiles(options)`                  | `@workerstack/backend/http/static`         | serves files under a prefix                                                               |
| `curlLogger(options?)`                  | `@workerstack/backend/http/curl-logger`    | logs each request as the command that would repeat it                                     |

Full reference: [middleware](https://github.com/workerstack/backend/blob/main/docs/middleware.md),
[rate limiting](https://github.com/workerstack/backend/blob/main/docs/capabilities/rate-limit.md) and
[compression](https://github.com/workerstack/backend/blob/main/docs/capabilities/compress.md).

## The request context

The handler's `ctx` is one object, and these keys are reserved on it: `req`, `env`, `executionCtx`, `path`,
`params`, `search`, `searchAll`, `headers`, `input`, `ip`, `res`, `errors`, `error`, `meta`, `routePattern`,
`cookies`, `log`, `logger`, `signal`, `background`, `tap` and `with`. Everything else on `ctx` is yours, from `context()` or
from a middleware's `next({ … })`.

```ts
import { httpApp } from "@workerstack/backend/http"

const app = httpApp()

app.get("/where/:id").handler((ctx) => {
	ctx.log.info({ id: ctx.params.id }, "asked")
	ctx.background(Promise.resolve())
	return ctx.res.json("ok", {
		accept: ctx.headers.accept ?? null,
		aborted: ctx.signal.aborted,
		id: ctx.params.id,
		ip: ctx.ip,
		pattern: ctx.routePattern,
		path: ctx.path,
		tags: ctx.searchAll.tag ?? [],
		verbose: ctx.search.verbose ?? null,
	})
})
```

`background(promise)` keeps work alive past the response where the runtime allows it, `signal` aborts when the client
leaves, and `log` is the request's logger with the request id already bound. `HttpContext` is the class behind it
and `HttpRes` the response builder, both exported for a helper of your own that takes either.

`ctx.with(overrides)` derives a context for a step that needs one member swapped. It answers the overrides and reads
everything else from `ctx`, so the logger, the parsed views, the signal and the queued taps stay the request's. It is
typed as the context it is called on: an override takes that member's declared type, and `req`, `res`, `input`,
`params` and `meta` cannot be replaced.

```ts
import { createMiddleware, httpApp } from "@workerstack/backend/http"

type Db = { name: string }
const withDb = createMiddleware((_ctx, next) => next({ db: { name: "shared" } as Db }))

const app = httpApp().use(withDb)

app.get("/tenants/:tenant/rows").handler((ctx) => {
	const tenant = ctx.with({ db: { name: ctx.params.tenant } })
	return ctx.res.json("ok", { db: tenant.db.name, path: tenant.path })
})
```

## Cookies

`ctx.cookies` reads them, and a response sets them. A signed cookie has a signer you build from its name and your
secrets, newest first, so a rotation keeps the old ones verifying and a value signed for one cookie never passes as
another:

```ts
import { httpApp } from "@workerstack/backend/http"
import { createCookieSigner } from "@workerstack/backend/http/cookie-sign"

const signer = createCookieSigner({ name: "session", secrets: [process.env.COOKIE_SECRET ?? ""] })

const app = httpApp()

app.post("/login").handler(async (ctx) => {
	const session = await signer.sign("user-1")
	const cookie = { value: session, httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" }
	return ctx.res.json("ok", { signedIn: true }, { cookies: { session: cookie } })
})

app.get("/me").handler(async (ctx) => {
	const raw = ctx.cookies.session
	const user = raw === undefined ? null : await signer.verify(raw)
	return ctx.res.json("ok", { user })
})
```

`@workerstack/backend/http/cookie` has the header functions on their own (`serializeCookie`, `parseCookieHeader`):

```ts
import { parseCookieHeader, serializeCookie } from "@workerstack/backend/http/cookie"

declare const req: Request

const jar = parseCookieHeader(req.headers.get("cookie") ?? "")
const header = serializeCookie("theme", { value: "dark", httpOnly: true, path: "/", sameSite: "lax" })
```

Full reference: [cookies](https://github.com/workerstack/backend/blob/main/docs/cookies.md).

## Streaming, WebSockets and realtime

A WebSocket route is `ws(app, path)`; a resumable connection — one logical subscription over WebSocket, SSE or
long-poll, whichever the client can hold — is `realtime(app, path, options)`. Both publish to rooms, and a plain
route can publish into them.

```ts
import { httpApp } from "@workerstack/backend/http"
import { realtime } from "@workerstack/backend/realtime"
import { ws } from "@workerstack/backend/ws"

const app = httpApp()

ws(app, "/echo").handler({
	onMessage(_ctx, socket, data) {
		socket.send(data)
	},
})

const chat = realtime(app, "/chat/:room", {
	namespace: "chat",
	handler: (_ctx, conn) => {
		conn.join("lobby")
		conn.on("message", (payload) => conn.publish("lobby", payload))
	},
})

app.post("/announce").handler(async (ctx) => {
	chat.publish("lobby", await ctx.req.json())
	return ctx.res.json("ok", { sent: true })
})
```

A publisher outside a connection works the same way, which is what a ticker is:

```ts
import { httpApp } from "@workerstack/backend/http"
import { realtime } from "@workerstack/backend/realtime"

const app = httpApp()

const prices = realtime(app, "/prices", {
	namespace: "prices",
	handler: (_ctx, conn) => {
		conn.join("ticker")
	},
})

setInterval(() => prices.publish("ticker", { eur: 1.08, at: Date.now() }), 1000)
```

A WebSocket route needs the Workers adapter, `workersWebSocket()` from `@workerstack/backend/ws`, set with
`app.wsAdapter(workersWebSocket())` in the Worker entry.

A resumed connection replays from the client's `Last-Event-ID` or `reconnect_token`.

Full reference: [WebSockets, realtime and SSE](https://github.com/workerstack/backend/blob/main/docs/realtime.md) and
[realtime resume](https://github.com/workerstack/backend/blob/main/docs/capabilities/realtime-resume.md).

## Running on Cloudflare Workers

An app runs as a Cloudflare Worker: `export default app` is the Worker's `fetch` handler, with named exports beside it,
and `scheduled` and `queue` move onto the default.

```ts
import { httpApp } from "@workerstack/backend/http"

const app = httpApp()
app.get("/health").handler((ctx) => ctx.res.text("ok", "ok"))

export default app
```

The app is the default export, and `app.fetch` the handler to wrap when you need to:

```ts
import { httpApp } from "@workerstack/backend/http"

type Env = { readonly SECRET: string }

const app = httpApp<Env>()
app.get("/health").handler((ctx) => ctx.res.text("ok", "ok"))

export default { fetch: (...args: Parameters<typeof app.fetch>) => app.fetch(...args) }
```

## Static files and proxying

`staticFiles()` serves what a resolver of yours returns, so the bytes can come from a bundle, a KV store or a disk
read — backend never assumes a filesystem.

```ts
import { httpApp } from "@workerstack/backend/http"
import { cacheControl } from "@workerstack/backend/http/cache-control"
import { staticFiles } from "@workerstack/backend/http/static"

const assets = new Map<string, Blob>([["/app.js", new Blob(["console.log(1)"])]])

const app = httpApp()
	.use(cacheControl({ public: true, maxAge: 3600 }))
	.use(staticFiles({ prefix: "/assets", resolve: (_ctx, path) => assets.get(path) ?? null }))
```

`proxy()` is a handler that forwards, which is what makes an app a gateway: you own the destination call, so the
upstream is explicit and nothing is reachable by accident.

```ts
import { httpApp } from "@workerstack/backend/http"
import { proxy } from "@workerstack/backend/http/proxy"

const app = httpApp()

app.all("/billing/*").handler(
	proxy({
		destination: (_ctx, url, init) => fetch(`https://billing.internal.example.com${url}`, init),
		requestHeaders: { "x-gateway": "edge" },
		timeout: 10_000,
	}),
)
```

Full reference: [static files](https://github.com/workerstack/backend/blob/main/docs/static.md) and
[proxying and gateways](https://github.com/workerstack/backend/blob/main/docs/proxy.md).

## The OpenAPI document

`serveOpenApi(app, options)` returns the app with the document and its reference UI mounted; `generateOpenApi` gives
you the document as a value instead, for a file you commit or a build step. Tags, servers with variables,
externalDocs and webhooks are all declared, never guessed.

```ts
import { httpApp } from "@workerstack/backend/http"
import { serveOpenApi } from "@workerstack/backend/http/openapi"
import { scalar } from "@workerstack/backend/http/openapi/scalar"

const app = httpApp()

app
	.get("/orders")
	.meta({ summary: "List orders", tags: ["orders"] })
	.handler((ctx) => ctx.res.json("ok", []))

serveOpenApi(app, {
	title: "Shop",
	version: "1.2.0",
	servers: [{ url: "https://{region}.api.example.com", variables: { region: { default: "eu" } } }],
	tags: [{ name: "orders", description: "Placing and tracking orders" }],
	docs: { "/docs": scalar },
})
```

The document as a value, the route manifest, YAML, and either reference page explicitly:

```ts
import { httpApp } from "@workerstack/backend/http"
import { generateManifest, generateOpenApi, serveManifest, toYaml } from "@workerstack/backend/http/openapi"
import { scalar } from "@workerstack/backend/http/openapi/scalar"
import { swagger } from "@workerstack/backend/http/openapi/swagger"

const app = httpApp()
app.get("/orders").handler((ctx) => ctx.res.json("ok", []))

const document = generateOpenApi(app, { info: { title: "Shop", version: "1.2.0" } })
const manifest = generateManifest(app, {})
const yaml = toYaml(document)

serveManifest(app, { path: "/manifest.json" })

/* the two reference pages, if you mount one yourself rather than through docs: */
const pages = [scalar({ title: "Shop", url: "/openapi.json" }), swagger({ title: "Shop", url: "/openapi.json" })]
```

Webhooks, the requests your API sends out, are declared once as a contract: the document states each event as a
Standard Webhooks delivery, and the contract signs each attempt:

```ts
import { httpApp } from "@workerstack/backend/http"
import { serveOpenApi } from "@workerstack/backend/http/openapi"
import { webhookContract } from "@workerstack/backend/http/webhook"
import * as z from "zod"

const events = webhookContract({
	"order.shipped": z.object({ orderId: z.string(), shippedAt: z.string() }),
})

const app = httpApp()

serveOpenApi(app, { title: "Shop", version: "1.0.0", webhooks: events })

const { body, headers } = await events.sign(
	"order.shipped",
	{ orderId: "ord_1", shippedAt: "2026-11-02T12:00:00Z" },
	{ id: "msg_1", occurredAt: new Date(), secrets: "whsec_a2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2s=" },
)
await fetch("https://example.com/hook", { body, headers, method: "POST" })
```

Full reference: [the OpenAPI document](https://github.com/workerstack/backend/blob/main/docs/openapi.md) and
[webhooks](https://github.com/workerstack/backend/blob/main/docs/capabilities/webhooks.md).

## Serving a prebuilt or external document

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
	json: { inline: { info: { title: "Shop", version: "1.2.0" }, openapi: "3.1.0", paths: {} } },
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

## The MCP server

There are two ways to serve your API's tools over the Model Context Protocol, and they run in different places. The
standalone server `clients generate --target mcp` writes needs Node, and is what a local stdio install
(Claude Desktop, Claude Code, Cursor) starts. The mounted endpoint below runs wherever the app runs — Workers
included — dispatches in process, and is guarded by the app's own auth. It is the one to use remotely.

`mcp(app, path, handler, options)` mounts the handler `codegen.mcp` generated beside your app:

```ts
import { httpApp } from "@workerstack/backend/http"
import { type McpHandler, mcp } from "@workerstack/backend/mcp"

/* in the app: import { mcpHandler } from "./_gen/mcp.gen.ts" */
declare const mcpHandler: McpHandler

const app = httpApp()
mcp(app, "/mcp", mcpHandler, {
	authenticate: (request) => /^ApiKey \S+$/.test(request.headers.get("authorization") ?? ""),
})
```

Three opt-ins ride on the mount. `oauth()` makes the endpoint an OAuth 2.1 resource server (RFC 9728 metadata and
Bearer challenges), which is what ChatGPT requires; `uploads()` takes files out of band, so a large file never goes
through a tool argument; `urlFiles()` lets a file argument be an https URL from a host you list.

```ts
import { httpApp } from "@workerstack/backend/http"
import { type McpHandler, mcp } from "@workerstack/backend/mcp"
import { oauth } from "@workerstack/backend/mcp/oauth"
import { memoryUploadStore, uploads } from "@workerstack/backend/mcp/uploads"
import { urlFiles } from "@workerstack/backend/mcp/url-files"

/* in the app: import { mcpHandler } from "./_gen/mcp.gen.ts" */
declare const mcpHandler: McpHandler
declare const UPLOAD_SECRET: string

const app = httpApp()
mcp(app, "/mcp", mcpHandler, {
	authenticate: (request) => /^ApiKey \S+$/.test(request.headers.get("authorization") ?? ""),
	oauth: oauth({
		authorizationServers: ["https://auth.example.com"],
		resource: "https://mcp.example.com/mcp",
		resourceName: "Example",
		scopesSupported: ["mcp:read"],
	}),
	uploads: uploads({ secret: UPLOAD_SECRET, store: memoryUploadStore() }),
	urlFiles: urlFiles({ hosts: ["files.example.com"] }),
})
```

`memoryUploadStore()` is for one process; on Workers the store is yours (a Durable Object for the claim, R2 for the
bytes), and the MCP page shows that end to end. Only a route marked `meta({ mcp: true })` becomes a tool, and each
tool's input and output schemas come from the route's own.

Full reference: [the generated MCP server](https://github.com/workerstack/backend/blob/main/docs/mcp.md), its
[structured output](https://github.com/workerstack/backend/blob/main/docs/mcp.md#reference) included.

## Logging and tracing

`logger()` sets where lines go, `requestLog()` turns on the one line per request, and `onError` maps a thrown value
to a response before the error is reported.

```ts
import { HttpError, httpApp } from "@workerstack/backend/http"
import { createLogger } from "@workerstack/backend/logger"
import { requestId } from "@workerstack/backend/http/request-id"

const app = httpApp()
	.use(requestId())
	.logger(createLogger({ level: "info" }))
	.requestLog(true)
	.onError((error, ctx) => {
		if (error instanceof HttpError && error.errorKey === "db_timeout") return ctx.jsonFromError(error)
		return undefined
	})

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))
```

Tracing is an adapter: `otelAdapter` nests `http.request` → `middleware.*` → `http.handler` and continues an incoming
W3C `traceparent`, so a span from a caller stays one trace. With it on, the logger's child binds `trace_id` and
`span_id`, and `requestId` stays the client-facing id.

```ts
import { httpApp } from "@workerstack/backend/http"
import { createLogger } from "@workerstack/backend/logger"
import { otelAdapter, type OtelApi } from "@workerstack/backend/telemetry/otel"

declare const api: OtelApi

const app = httpApp()
	.logger(createLogger({ level: "info" }))
	.telemetry(otelAdapter(api))
	.requestLog(true)

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))
```

A request logged as the command that would repeat it is its own middleware, and the same formatter is available on
its own for a failing call you want to paste into a terminal — both redact credentials by default:

```ts
import { httpApp } from "@workerstack/backend/http"
import { curlLogger } from "@workerstack/backend/http/curl-logger"
import { requestToCurl } from "@workerstack/backend/http/request-to-curl"

declare const req: Request

const app = httpApp().use(curlLogger())
app.get("/").handler((ctx) => ctx.res.text("ok", "up"))

/* the authorization header left out of the logged command */
const command = await requestToCurl(req, { excludeHeader: (name) => name === "authorization" })
```

Full reference: [logging, errors and tracing](https://github.com/workerstack/backend/blob/main/docs/observability.md).

## Internationalization and crypto

Error messages translate through a dictionary you supply, and ICU messages interpolate with plurals:

```ts run
import { interpolate } from "@workerstack/backend/http/i18n"

const message = "{count, plural, one {# new message} other {# new messages}} for {name}"
console.log(interpolate(message, { count: 3, name: "Ada" }, "en"))
// prints: 3 new messages for Ada
```

```ts
import { defineErrors, httpApp } from "@workerstack/backend/http"
import { createErrorTranslator, translateError } from "@workerstack/backend/http/i18n"

const errors = defineErrors({ not_found: "not_found" })

/* locale, then error key, then the ICU template that key's message reads from */
const translations = { errors: { de: { not_found: "Nicht gefunden" }, en: { not_found: "Not found" } } }

const app = httpApp().errorI18n(
	createErrorTranslator({
		...translations,
		resolveLocale: (ctx) => ctx.headers["accept-language"]?.slice(0, 2) ?? "en",
	}),
)

app.get("/books/:id").handler((ctx) => ctx.res.json("ok", { id: ctx.params.id }))

const german = translateError(errors.not_found(), translations, "de")
```

Crypto is WebCrypto, with the comparison that does not leak by timing. It resolves a boolean, so await it:

```ts run
import { timingSafeEqual } from "@workerstack/backend/crypto"

const expected = "s3cret-token"
if (await timingSafeEqual("s3cret-token", expected)) console.log("token accepted")
if (!(await timingSafeEqual("guess", expected))) console.log("guess refused")
// prints: token accepted
// prints: guess refused
```

Full reference: [internationalization](https://github.com/workerstack/backend/blob/main/docs/i18n.md),
[crypto](https://github.com/workerstack/backend/blob/main/docs/crypto.md),
[JWT](https://github.com/workerstack/backend/blob/main/docs/jwt.md),
[user agent](https://github.com/workerstack/backend/blob/main/docs/user-agent.md),
[cron](https://github.com/workerstack/backend/blob/main/docs/cron.md) and
[queue](https://github.com/workerstack/backend/blob/main/docs/queue.md).

## Testing

`testClient(app, options)` calls the app the way a client would, in process — no port, no server. Request fields a handler reads but a test cannot easily forge, such as `ip`, are
options rather than mocks.

```ts run
import { httpApp } from "@workerstack/backend/http"
import { testClient } from "@workerstack/backend/http/testing"

const app = httpApp()
app.get("/hello").handler((ctx) => ctx.res.json("ok", { hello: ctx.search.name ?? "world", ip: ctx.ip }))

const client = testClient(app, { env: {} })
const answer = await client.get("/hello", { search: { name: "Ada" }, ip: "203.0.113.7" })
console.log(answer.status, JSON.stringify(await answer.json()))
// prints: 200 {"hello":"Ada","ip":"203.0.113.7"}
```

Full reference: [testing an app](https://github.com/workerstack/backend/blob/main/docs/testing.md) and
[SDK conformance](https://github.com/workerstack/clients/blob/main/docs/conformance.md), which is how the generated
clients are held to behaving alike.

## The build plugin and the backend CLI

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

## Generated clients

`clients` reads the app module or the document and writes clients that know the routes:

```sh
npx --package @workerstack/clients clients generate --app src/app.ts --target ts --target python --out generated
```

A call answers your value and throws a typed error by status; its `client.safe` mirror answers the same calls as a
`Result` instead, so a failure is a value rather than a throw. All six SDKs have both styles.

```ts sdk
import { DecodeError, Kitchen, NotFoundError } from "./kitchen"

export function newClient(): Kitchen {
	return new Kitchen({
		baseURL: "https://api.example.com",
		headers: { authorization: `Bearer ${process.env.KITCHEN_TOKEN ?? ""}` },
		timeout: 10_000,
	})
}

export async function organization(client: Kitchen, orgId: string): Promise<string | null> {
	try {
		await client.getApiV1OrganizationsByOrgId({ params: { orgId } })
		return orgId
	} catch (error) {
		if (error instanceof NotFoundError) return null
		throw error
	}
}

export async function health(client: Kitchen): Promise<string> {
	const result = await client.safe.getApiHealth()
	if (result.ok) return "up"
	if (result.error instanceof DecodeError) return `unreadable answer: ${result.error.message}`
	return `answered ${result.error.status}`
}
```

That block is a slice of
[the compiled example](https://github.com/workerstack/clients/blob/main/docs/examples/ts/example.ts), which the generator's own tests
type-check against an SDK generated from a real document.

Full reference: [code generation](https://github.com/workerstack/clients/blob/main/docs/codegen.md),
[the generated clients](https://github.com/workerstack/clients/blob/main/docs/client.md),
[their per-language recipes](https://github.com/workerstack/clients/blob/main/docs/sdk-recipes.md),
[the generated CLI](https://github.com/workerstack/clients/blob/main/docs/cli.md) and
[releasing it](https://github.com/workerstack/clients/blob/main/docs/cli-release.md).

## Every export

Each feature is a subpath: import what the app uses, and a bundle carries nothing else. An app that never imports
`@workerstack/backend/ws` bundles no WebSocket code, and one that never imports `@workerstack/backend/http/openapi` no document
generator.

| Export                                      | What it holds                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@workerstack/backend/http`                 | `backend`, `HttpError`, `defineErrors`, `createMiddleware`, `mergeTree`, and the type helpers below                                                                                  |
| `@workerstack/backend/ws`                   | `ws(app, path)`, a WebSocket route; `workersWebSocket`                                                                                                                               |
| `@workerstack/backend/http/webhook`         | `signWebhook`                                                                                                                                                                        |
| `@workerstack/backend/cron`                 | `defineCron`, `CronConfig`, `CronDefinition`, `CronHandler`, `CronJob`, `CronSchedule`; `workersCron`, `WorkersScheduledController`                                                  |
| `@workerstack/backend/queue`                | `queueContract`, `queueMessage`, `defineConsumer`, `deadLetter`, `QueueBodyError`, `QueueDeadLetter`, and their types; `workersQueue`, `WorkersQueueOptions` and the binding's types |
| `@workerstack/backend/http/user-agent`      | `parseUserAgent`, `ParsedUserAgent`, `DeviceType`                                                                                                                                    |
| `@workerstack/backend/realtime`             | `realtime(app, path, options)`: a resumable connection over WebSocket, SSE and long-poll                                                                                             |
| `@workerstack/backend/mcp`                  | `mcp(app, path, handler, options?)`: the app's tools over MCP's Streamable HTTP, the handler `codegen.mcp` writes                                                                    |
| `@workerstack/backend/mcp/oauth`            | `oauth(options)`: `mcp()`'s opt-in OAuth 2.1 resource server (RFC 9728 metadata, Bearer challenges)                                                                                  |
| `@workerstack/backend/mcp/uploads`          | `uploads(options)`, `memoryUploadStore()`: `mcp()`'s opt-in out-of-band file uploads (the file-uploads extension's flow)                                                             |
| `@workerstack/backend/mcp/url-files`        | `urlFiles(options)`: `mcp()`'s opt-in file arguments as https URLs from listed hosts                                                                                                 |
| `@workerstack/backend/http/openapi`         | `serveOpenApi`, `serveManifest`, `generateOpenApi`, `generateManifest`, `toYaml`                                                                                                     |
| `@workerstack/backend/http/openapi/auth`    | `basic`, `credentialsMatch`: HTTP Basic in front of a served document and its docs pages                                                                                             |
| `@workerstack/backend/http/openapi/scalar`  | `scalar`, the Scalar API reference page                                                                                                                                              |
| `@workerstack/backend/http/openapi/static`  | `serveStaticOpenApi`, a document built ahead of time or living elsewhere, served without the generator                                                                               |
| `@workerstack/backend/http/openapi/swagger` | `swagger`, the Swagger UI page                                                                                                                                                       |
| `@workerstack/backend/http/i18n`            | `createErrorTranslator`, `translateError`, `interpolate`, `createInterpolator`                                                                                                       |
| `@workerstack/backend/http/input`           | `streamed()`, a request body left unread for the handler                                                                                                                             |
| `@workerstack/backend/http/range`           | `rangeResponse`, a `Range` request answered from bytes                                                                                                                               |
| `@workerstack/backend/http/cache-control`   | `cacheControl`, `httpDate`                                                                                                                                                           |
| `@workerstack/backend/http/compress`        | `compress`                                                                                                                                                                           |
| `@workerstack/backend/http/etag`            | `etag`, `notModified`                                                                                                                                                                |
| `@workerstack/backend/http/rate-limit`      | `rateLimit`, `memoryRateLimitStore`                                                                                                                                                  |
| `@workerstack/backend/http/cors`            | `cors`                                                                                                                                                                               |
| `@workerstack/backend/http/csrf`            | `csrf`                                                                                                                                                                               |
| `@workerstack/backend/http/body-limit`      | `bodyLimit`                                                                                                                                                                          |
| `@workerstack/backend/http/timeout`         | `timeout`                                                                                                                                                                            |
| `@workerstack/backend/http/ip-restrict`     | `ipRestrict`, `ipAllowed`, `isIpRule`                                                                                                                                                |
| `@workerstack/backend/http/request-id`      | `requestId`                                                                                                                                                                          |
| `@workerstack/backend/http/secure-headers`  | `secureHeaders`                                                                                                                                                                      |
| `@workerstack/backend/http/server-timing`   | `serverTiming`                                                                                                                                                                       |
| `@workerstack/backend/http/powered-by`      | `poweredBy`                                                                                                                                                                          |
| `@workerstack/backend/http/pretty-json`     | `prettyJson`                                                                                                                                                                         |
| `@workerstack/backend/logger`               | `createLogger`                                                                                                                                                                       |
| `@workerstack/backend/http/curl-logger`     | `curlLogger`, a request logged as a command that repeats it                                                                                                                          |
| `@workerstack/backend/telemetry/otel`       | `otelAdapter`                                                                                                                                                                        |
| `@workerstack/backend/http/static`          | `staticFiles`                                                                                                                                                                        |
| `@workerstack/backend/http/proxy`           | `proxy`, a route that forwards to an upstream                                                                                                                                        |
| `@workerstack/backend/http/accepts`         | `accepts`, content negotiation                                                                                                                                                       |
| `@workerstack/backend/http/cookie`          | `serializeCookie`, `parseCookieHeader`                                                                                                                                               |
| `@workerstack/backend/http/cookie-sign`     | `createCookieSigner`                                                                                                                                                                 |
| `@workerstack/backend/crypto`               | `timingSafeEqual`                                                                                                                                                                    |
| `@workerstack/backend/http/request-to-curl` | `requestToCurl`                                                                                                                                                                      |
| `@workerstack/backend/http/testing`         | `testClient`, an app called in process                                                                                                                                               |
| `@workerstack/backend/http/tree`            | the route tree's types                                                                                                                                                               |
| `@workerstack/backend/plugin`               | `backendPlugin()`, the Vite plugin that generates the app's artifacts                                                                                                                |
| `@workerstack/backend/build`                | `createBuildPlugin`, a production bundle for a deploy target                                                                                                                         |

`@workerstack/backend/http` exports `httpApp()` and the `HttpApp` class behind it, `HttpContext` and `HttpRes` (the handler's
`ctx` and its `ctx.res`), `HttpError`, `defineErrors` and `ERROR_META`, `definePreset` and `HttpPreset`, `createMiddleware` and
`mergeTree`.

## Type helpers

Exported from `@workerstack/backend/http`, each over the app you built (`typeof app`). This is how a test, a client or a
helper of yours stays tied to the routes rather than to a copy of their shapes.

```ts
import { httpApp, type InferRouteInput, type InferRoutePaths, type InferRoutes } from "@workerstack/backend/http"
import * as z from "zod"

const app = httpApp()
	.get("/books/:id")
	.input({ params: { id: z.string().min(1) }, search: z.object({ edition: z.string().optional() }) })
	.handler((ctx) => ctx.res.json("ok", { edition: ctx.input.search.edition, id: ctx.params.id }))

type Paths = InferRoutePaths<typeof app>
type Routes = InferRoutes<typeof app>
type BookInput = InferRouteInput<typeof app, "/books/:id", "get">

const path: Paths = "/books/:id"
declare const input: BookInput
const edition: string | undefined = input.search.edition
```

| Type                                         | What it describes                                                |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `InferRoutes<typeof app>`                    | every path, its methods, and each one's input, output and errors |
| `InferRoutePaths<typeof app>`                | the paths, as a union                                            |
| `InferRouteMethods<typeof app, Path>`        | one path's methods                                               |
| `InferRouteInput<typeof app, Path, Method>`  | a route's validated input                                        |
| `InferRouteOutput<typeof app, Path, Method>` | a route's output map                                             |
| `InferRouteErrors<typeof app, Path, Method>` | a route's declared error keys                                    |
| `InferRouteMeta<typeof app, Path, Method>`   | a route's meta                                                   |
| `InferRouteCtx<typeof app, Path, Method>`    | a route's handler `ctx`                                          |
| `InferCtx<typeof app>`                       | the app's handler context                                        |
| `InferEnv<typeof app>`                       | `ctx.env`                                                        |
| `InferMeta<typeof app>`                      | the app-level meta                                               |
| `InferErrorFactory<typeof app>`              | the error factory                                                |
| `InferBasePath<typeof app>`                  | the base path, as a string                                       |
| `InferMethods<typeof app>`                   | the methods the app serves                                       |

## Documentation

Every page's examples are compiled by the repository's tests.

- [All the docs](https://github.com/workerstack/backend/blob/main/docs/README.md)
- [Migrating from 0.7](https://github.com/workerstack/backend/blob/main/docs/migration.md)
- [Package exports](https://github.com/workerstack/backend/blob/main/docs/packages.md)
- [What a tarball ships, and why](https://github.com/workerstack/backend/blob/main/packages/core/docs/packaging.md)
- [The repository](https://github.com/workerstack/backend)

## License

MIT
