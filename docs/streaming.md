# Streaming

Three helpers stream an answer. `ctx.res.stream(producer)` writes bytes, `ctx.res.generate(iterable)` sends what an
iterable yields, and `ctx.res.sse(producer, options)` sends server-sent events. Each one is pulled by the client: a
send waits until the client reads, so a producer never runs further ahead than the connection's buffers, and a
client that stops reading holds the producer back.

When the client leaves, the stream closes, `stream.closed` turns true, a waiting send rejects, and the producer's
`finally` runs. Put cleanup there: a subscription, a timer, a database cursor.

## A producer that does no I/O should yield per send

A producer that never awaits anything but `send` keeps the event loop busy until the connection's buffers fill.
Its first event reaches the client only then: about 0.7 s for small events, longer under load. A producer
that awaits real work (a query, a queue, a timer) yields on its own. One that only computes should yield a turn per
send, with `await new Promise((resolve) => setTimeout(resolve, 0))`.

## Example: an SSE producer that cleans up when the client leaves

`defaultRetry` tells the client how long to wait before reconnecting, and the `finally` runs whether the producer
ends on its own or the client goes away. This block runs as part of the docs' tests.

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

## Declare the events a stream sends

Under `.output()`, `text/event-stream` declares its events at `ok`. A map names each event and the schema of its
data; a bare schema is the one `message` event, whose name `send` may leave out. `stream.send` then takes only a
declared name, with that schema's data: a string goes out as is, anything else as JSON. `ok: true` keeps the
untyped stream.

Each event is checked against its schema while the output check is on, as it is in development and tests. An event
that fails, or one the map does not name, is not sent: the log names it, the stream ends, and the next send rejects.
The document writes each event under the response's `itemSchema`, so generated clients can type them. This block
runs as part of the docs' tests.

```ts run
import { httpApp } from "@workerstack/backend/http"
import * as z from "zod"

const app = httpApp()

app
	.get("/scores")
	.meta({ operationId: "scores.list" })
	.output({ "text/event-stream": { ok: { heartbeat: z.string(), score: z.object({ n: z.number() }) } } })
	.handler((ctx) =>
		ctx.res.sse(async (stream) => {
			await stream.send({ data: "ok", event: "heartbeat" })
			await stream.send({ data: { n: 42 }, event: "score" })
			// @ts-expect-error "goal" is no declared event
			await stream.send({ data: "x", event: "goal" }).catch(() => {})
		}),
	)

const response = await app.fetch(new Request("http://localhost/scores"), {})
const text = await response.text()
console.log(text.includes('event: score\ndata: {"n":42}') ? "score sent" : "no score")
console.log(text.includes("event: goal") ? "goal sent" : "goal refused")
// prints: score sent
// prints: goal refused
```

The refused send logs one line, such as `sse goal: undeclared event`, or
`sse score: invalid data: n: Invalid input: expected number, received string` for data that fails its schema.
