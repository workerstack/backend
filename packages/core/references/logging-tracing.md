---
description: Logging and tracing
order: 190
---

# Logging and tracing

`logger()` sets where lines go, `requestLog()` turns on the one line per request, and `onError` maps a thrown value
to a response before the error is reported.

```ts
import { HttpError, httpApp } from "@workerstack/backend/http"
import { createLogger } from "@workerstack/backend/logger"
import { requestId } from "@workerstack/backend/http/request-id"

const app = httpApp()
	.use(requestId())
	.logger(createLogger({ level: "info" }))
	.requestLog(true)
	.onError((error, ctx) => {
		if (error instanceof HttpError && error.errorKey === "db_timeout") return ctx.jsonFromError(error)
		return undefined
	})

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))
```

Tracing is an adapter: `otelAdapter` nests `http.request` → `middleware.*` → `http.handler` and continues an incoming
W3C `traceparent`, so a span from a caller stays one trace. With it on, the logger's child binds `trace_id` and
`span_id`, and `requestId` stays the client-facing id.

```ts
import { httpApp } from "@workerstack/backend/http"
import { createLogger } from "@workerstack/backend/logger"
import { otelAdapter, type OtelApi } from "@workerstack/backend/telemetry/otel"

declare const api: OtelApi

const app = httpApp()
	.logger(createLogger({ level: "info" }))
	.telemetry(otelAdapter(api))
	.requestLog(true)

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))
```

A request logged as the command that would repeat it is its own middleware, and the same formatter is available on
its own for a failing call you want to paste into a terminal — both redact credentials by default:

```ts
import { httpApp } from "@workerstack/backend/http"
import { curlLogger } from "@workerstack/backend/http/curl-logger"
import { requestToCurl } from "@workerstack/backend/http/request-to-curl"

declare const req: Request

const app = httpApp().use(curlLogger())
app.get("/").handler((ctx) => ctx.res.text("ok", "up"))

/* the authorization header left out of the logged command */
const command = await requestToCurl(req, { excludeHeader: (name) => name === "authorization" })
```

Full reference: [logging, errors and tracing](https://github.com/workerstack/backend/blob/main/docs/observability.md).
