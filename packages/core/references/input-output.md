---
description: Input and output schemas
order: 60
---

# Input and output

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
