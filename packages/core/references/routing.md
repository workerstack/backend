---
description: Methods, paths and params
order: 50
---

# Routing

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

app
	.delete("/users/:id")
	.meta({ operationId: "users.delete" })
	.handler((ctx) => ctx.res.noContent())

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
