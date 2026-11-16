---
description: The OpenAPI document
order: 160
---

# The OpenAPI document

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
	.meta({ operationId: "orders.list", summary: "List orders", tags: ["orders"] })
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
app
	.get("/orders")
	.meta({ operationId: "orders.list" })
	.handler((ctx) => ctx.res.json("ok", []))

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
