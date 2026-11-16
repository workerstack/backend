---
description: What a handler's ctx carries
order: 100
---

# The request context

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
