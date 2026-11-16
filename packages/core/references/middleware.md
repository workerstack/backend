---
description: Middleware and its scope
order: 90
---

# Middleware

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
