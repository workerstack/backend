# Cache-Control

`cacheControl(options)` from `@workerstack/backend/http/cache-control` sets the
`Cache-Control` header on every answer below it: `maxAge`, `sMaxAge`, `staleWhileRevalidate`, `public`, `private`,
`noCache`, `noStore`, `mustRevalidate` and `immutable`. An answer that already set its own `Cache-Control` keeps it.
Pair it with `etag()` from `@workerstack/backend/http/etag` for revalidation with 304 answers.

## Example

```ts
import { httpApp } from "@workerstack/backend/http"
import { cacheControl } from "@workerstack/backend/http/cache-control"
import { etag } from "@workerstack/backend/http/etag"

const app = httpApp()
	.use(etag())
	.use(cacheControl({ public: true, maxAge: 60, staleWhileRevalidate: 300 }))

app.get("/prices").handler((ctx) => ctx.res.json("ok", { eur: 1.08 }))
```

Tested by: `response/cache-control.test.ts`
