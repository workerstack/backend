---
description: One route, end to end
order: 30
---

# A route, end to end

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
app
	.get("/health")
	.meta({ operationId: "health.check" })
	.handler((ctx) => ctx.res.text("ok", "ok"))

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
