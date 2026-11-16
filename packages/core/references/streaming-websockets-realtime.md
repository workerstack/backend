---
description: Streams, WebSockets, realtime
order: 130
---

# Streaming, WebSockets and realtime

A WebSocket route is `ws(app, path)`; a resumable connection — one logical subscription over WebSocket, SSE or
long-poll, whichever the client can hold — is `realtime(app, path, options)`. Both publish to rooms, and a plain
route can publish into them.

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

A publisher outside a connection works the same way, which is what a ticker is:

```ts
import { httpApp } from "@workerstack/backend/http"
import { realtime } from "@workerstack/backend/realtime"

const app = httpApp()

const prices = realtime(app, "/prices", {
	namespace: "prices",
	handler: (_ctx, conn) => {
		conn.join("ticker")
	},
})

setInterval(() => prices.publish("ticker", { eur: 1.08, at: Date.now() }), 1000)
```

A WebSocket route needs the Workers adapter, `workersWebSocket()` from `@workerstack/backend/ws`, set with
`app.wsAdapter(workersWebSocket())` in the Worker entry.

A resumed connection replays from the client's `Last-Event-ID` or `reconnect_token`.

Full reference: [WebSockets, realtime and SSE](https://github.com/workerstack/backend/blob/main/docs/realtime.md) and
[realtime resume](https://github.com/workerstack/backend/blob/main/docs/capabilities/realtime-resume.md).
