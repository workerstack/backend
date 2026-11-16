---
description: Work a route hands off
order: 110
---

# Taps

A tap is work a route hands off once it has answered: an audit row, a webhook, a metric. `defineTap(name, schema,
handler)` defines one, `app.tap(tap)` registers it, and `ctx.tap(tap, payload)` fires it. The payload is typed by the
schema's input and checked at the call, and the handler gets the schema's output. A route can fire a tap from its
meta too: declare the key with `metaType<TapMeta<typeof tap>>()` and set it in `.meta()`, where the value is checked
when the routes compile.

A tap runs after the response, in the background, so it never delays or changes it, and a failing tap is logged as a
warn. Nothing fires on an error answer, a 404 or 405, or a WebSocket upgrade. Firing a tap the app did not register
throws `tap audit: not registered on this app`, and a payload the schema refuses fails the request with a 500.

```ts
import { defineTap, httpApp, type TapMeta } from "@workerstack/backend/http"
import * as z from "zod"

const audit = defineTap("audit", z.object({ action: z.string() }), (ctx, payload) => {
	const row = JSON.stringify({ action: payload.action, path: ctx.path })
	ctx.background(fetch("https://audit.example.com/rows", { body: row, method: "POST" }))
})

const app = httpApp().metaType<TapMeta<typeof audit>>().tap(audit)

app.post("/items").handler((ctx) => {
	ctx.tap(audit, { action: "items.create" })
	return ctx.res.json("created", { ok: true })
})

app
	.delete("/items/:id")
	.meta({ audit: { action: "items.delete" } })
	.handler((ctx) => ctx.res.json("ok", { id: ctx.params.id }))
```
