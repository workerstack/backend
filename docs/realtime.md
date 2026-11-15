# WebSockets, realtime and SSE

Three ways to push to a client. `ws(app, path)` from `@workerstack/backend/ws` is a WebSocket route with
typed messages. `realtime(app, path, options)` from `@workerstack/backend/realtime` is a resumable connection over
WebSocket, then SSE, then long-poll, with rooms and a publisher. `ctx.res.sse()` is a server-sent event stream, with
`lastEventId` for resume and a keepalive.

A WebSocket route needs the Workers adapter, `workersWebSocket()` from `@workerstack/backend/ws`. The streaming page covers SSE producers in depth.

## Example

```ts
import { httpApp } from "@workerstack/backend/http"
import { realtime } from "@workerstack/backend/realtime"
import { ws } from "@workerstack/backend/ws"

const app = httpApp()

ws(app, "/echo").handler({
	onMessage(_ctx, socket, data) {
		socket.send(data)
	},
})

const chat = realtime(app, "/chat/:room", {
	namespace: "chat",
	handler: (_ctx, conn) => {
		conn.join("lobby")
		conn.on("message", (payload) => conn.publish("lobby", payload))
	},
})

app.post("/announce").handler(async (ctx) => {
	chat.publish("lobby", await ctx.req.json())
	return ctx.res.json("ok", { sent: true })
})
```

## Typed messages

`.messages({ receive, send })` gives each direction a Standard Schema. `onMessage` gets what `receive` parses, and
`socket.send` takes only what `send` accepts. Each frame must be one JSON text frame.

```ts
import * as z from "zod"
import { httpApp } from "@workerstack/backend/http"
import { ws } from "@workerstack/backend/ws"

const app = httpApp()

const TalkIn = z.discriminatedUnion("type", [
	z.object({ type: z.literal("say"), text: z.string() }),
	z.object({ type: z.literal("ping") }),
])
const TalkOut = z.discriminatedUnion("type", [
	z.object({ type: z.literal("said"), text: z.string() }),
	z.object({ type: z.literal("pong") }),
])

ws(app, "/talk")
	.meta({ operationId: "ws.talk" })
	.messages({ receive: TalkIn, send: TalkOut })
	.handler({
		onMessage(_ctx, socket, msg) {
			socket.send(msg.type === "say" ? { type: "said", text: msg.text } : { type: "pong" })
		},
	})
```

- A frame `receive` refuses never reaches `onMessage`. `onError` gets an `HttpError` with the key `invalid_message`,
  and the socket closes with 1007 and `invalid message: <issue>`. Frames after it are dropped. Bad JSON and binary
  frames close the same way, with `expected a JSON text frame`.
- While the output check is on, a message `send` refuses is not sent. The log reads
  `ws send: invalid message: <issue>`, and the socket closes with 1011 `invalid outgoing message`. A production build
  without the output check sends it as it is.
- The document writes `x-websocket: { receive, send }`, each a `$ref` named from the operationId (`WsTalkReceive`,
  `WsTalkSend`). A tagged union gets a `discriminator`. A direction you leave out stays untyped, and a route without
  `.messages()` keeps `x-websocket: true`.

## Typed realtime messages

`realtime()` takes the same `messages: { receive, send }`. `conn.on("message")` gets what `receive` parses.
`conn.send`, `conn.publish` and the publisher `realtime()` returns take only what `send` accepts.

```ts
import * as z from "zod"
import { httpApp } from "@workerstack/backend/http"
import { realtime } from "@workerstack/backend/realtime"

const app = httpApp()

const RoomIn = z.discriminatedUnion("type", [
	z.object({ type: z.literal("say"), text: z.string() }),
	z.object({ type: z.literal("leave") }),
])
const RoomOut = z.discriminatedUnion("type", [
	z.object({ type: z.literal("said"), text: z.string() }),
	z.object({ type: z.literal("left") }),
])

const room = realtime(app, "/rt/room", {
	meta: { operationId: "rt.room" },
	messages: { receive: RoomIn, send: RoomOut },
	handler: (_ctx, conn) => {
		conn.join("lobby")
		conn.on("message", (msg) =>
			conn.publish("lobby", msg.type === "say" ? { type: "said", text: msg.text } : { type: "left" }),
		)
	},
})

app
	.post("/rt/announce")
	.meta({ operationId: "rt.announce" })
	.handler(async (ctx) => {
		await room.publish("lobby", { type: "said", text: "welcome" })
		return ctx.res.json("ok", { sent: true })
	})
```

- A frame `receive` refuses never reaches `conn.on("message")`. The route's `onError` gets an `HttpError` with the key
  `invalid_message`, and can still `conn.send` an answer. Then the connection closes with 1007
  `invalid message: <issue>`, and frames after it are dropped. Bad JSON and binary frames close the same way, with
  `expected a JSON text frame`. A route without `receive` still ignores them.
- While the output check is on, a `conn.send` or `conn.publish` that `send` refuses is not delivered. The log reads
  `realtime send: invalid message: <issue>`, the connection closes with 1011 `invalid outgoing message`, and nothing
  it sends later goes out.
- The publisher throws a `TypeError` `realtime publish: invalid message: <issue>` for a message `send` refuses, and
  later publishes go on. When `send` is async, `publish` returns a promise that rejects the same way: await it.
  `publisher.namespace(name)` is never checked.
- The document marks every `realtime()` route `x-realtime: true`, and writes its messages as `.messages()` does
  (`RtRoomReceive`, `RtRoomSend`). A generated client calls an `x-realtime` operation as a realtime connection.

## Reference

| Value                                                                             | Default | What it does                                                                                                                                                                                             | Watch for                                                                                                     |
| --------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| WS route handler: `ws(app, path).handler({ … })`                                  | —       | handles an upgraded WebSocket; 101 performed by the adapter; `ws` is imported from `@workerstack/backend/ws`, not an app method                                                                          | the upgrade path is matched by a separate finalize plan                                                       |
| WS `.input()` / `.messages()` / `.meta()` / `.errors()` / `.origins()` / `.use()` | —       | upgrade input (search, headers, cookies) and errors, documented as parameters and pre-101 answers; typed receive and send messages, each frame checked (1007 on a miss); meta, origin policy, middleware | an open `origins` policy accepts any origin — set it                                                          |
| `realtime(app, path, { meta })`                                                   | —       | the connection route's meta, as WS `.meta()` takes it: its `operationId` documents the route                                                                                                             | refuses the HTTP-only keys `invalidate`, `mcp`, `security` and `deprecated`, as WS `.meta()` does             |
| `realtime(app, path, { messages })`                                               | —       | typed receive and send messages, as WS `.messages()` takes them: each frame checked (1007 on a miss), each send and publish checked while the output check is on                                         | an async `send` schema makes `publish` return a promise: await it                                             |
| WS origin policy                                                                  | —       | allow/deny upgrade by `Origin`                                                                                                                                                                           | a missing policy is a cross-site WS risk                                                                      |
| `ctx.res.sse(...)`                                                                | —       | `text/event-stream`; `ok` maps each event name to its data schema (a bare schema is `message`), `send` is typed and checked by it, and the document writes `itemSchema`                                  | an undeclared event, or data its schema refuses, is not sent and ends the stream while the output check is on |
| `x-realtime: true`                                                                | —       | `realtime()` writes it on its route, so a generated client calls it as a realtime connection                                                                                                             | a `ws()` route never has it; a meta extension cannot unset it on a `realtime()` route                         |
| `Last-Event-ID` resume                                                            | —       | resume a dropped SSE/WS stream from the last id                                                                                                                                                          | reconnect parity is uniform across all SDKs in v1                                                             |
| reference resume server                                                           | ships   | the conformance target the SDK reconnect tests run against                                                                                                                                               | kept in `tests/` so reconnect is actually exercised                                                           |
| realtime bus / publisher (`RealtimeBus`, `RealtimePublisher`)                     | —       | server-side pub/sub backing the resume stream                                                                                                                                                            | at-least-once vs at-most-once is the app's choice                                                             |
| runtime                                                                           | workers | the Workers WebSocket adapter (`ws/workers.ts`)                                                                                                                                                          | one adapter: `workersWebSocket()`                                                                             |
