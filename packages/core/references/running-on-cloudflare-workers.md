---
description: Running on Cloudflare Workers
order: 140
---

# Running on Cloudflare Workers

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
