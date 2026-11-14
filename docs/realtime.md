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

## Reference

| Value                                                             | Default | What it does                                                                                                                    | Watch for                                                                                         |
| ----------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| WS route handler: `ws(app, path).handler({ … })`                  | —       | handles an upgraded WebSocket; 101 performed by the adapter; `ws` is imported from `@workerstack/backend/ws`, not an app method | the upgrade path is matched by a separate finalize plan                                           |
| WS `.input()` / `.meta()` / `.errors()` / `.origins()` / `.use()` | —       | typed WS message input, meta, errors, origin policy, middleware                                                                 | an open `origins` policy accepts any origin — set it                                              |
| `realtime(app, path, { meta })`                                   | —       | the connection route's meta, as WS `.meta()` takes it: its `operationId` documents the route                                    | refuses the HTTP-only keys `invalidate`, `mcp`, `security` and `deprecated`, as WS `.meta()` does |
| WS origin policy                                                  | —       | allow/deny upgrade by `Origin`                                                                                                  | a missing policy is a cross-site WS risk                                                          |
| `ctx.res.sse(...)`                                                | —       | `text/event-stream`; v1 types the declared event schema                                                                         | the declared event schema must reach the SDK types                                                |
| `.meta({ extensions: { "x-realtime": true } })`                   | off     | opts the operation into the resume protocol                                                                                     | consumer-driven; backend never sets it itself                                                     |
| `Last-Event-ID` resume                                            | —       | resume a dropped SSE/WS stream from the last id                                                                                 | reconnect parity is uniform across all SDKs in v1                                                 |
| reference resume server                                           | ships   | the conformance target the SDK reconnect tests run against                                                                      | kept in `tests/` so reconnect is actually exercised                                               |
| realtime bus / publisher (`RealtimeBus`, `RealtimePublisher`)     | —       | server-side pub/sub backing the resume stream                                                                                   | at-least-once vs at-most-once is the app's choice                                                 |
| runtime                                                           | workers | the Workers WebSocket adapter (`ws/workers.ts`)                                                                                 | one adapter: `workersWebSocket()`                                                                 |
