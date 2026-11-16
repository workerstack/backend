---
description: The ctx.res response helpers
order: 70
---

# Responses

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

Under `.output()`, `text/event-stream` declares its events at `ok`: a map from event name to data schema, or one
bare schema for the `message` event. `stream.send` then takes only those names with their data, each event is
checked, and the document writes them under `itemSchema`.

Full reference: [streaming](https://github.com/workerstack/backend/blob/main/docs/streaming.md),
[media types](https://github.com/workerstack/backend/blob/main/docs/capabilities/media-types.md),
[range requests](https://github.com/workerstack/backend/blob/main/docs/capabilities/range.md) and
[Cache-Control](https://github.com/workerstack/backend/blob/main/docs/capabilities/cache-control.md).
