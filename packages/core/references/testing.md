---
description: Testing an app in process
order: 210
---

# Testing

`testClient(app, options)` calls the app the way a client would, in process — no port, no server. Request fields a handler reads but a test cannot easily forge, such as `ip`, are
options rather than mocks.

```ts run
import { httpApp } from "@workerstack/backend/http"
import { testClient } from "@workerstack/backend/http/testing"

const app = httpApp()
app.get("/hello").handler((ctx) => ctx.res.json("ok", { hello: ctx.search.name ?? "world", ip: ctx.ip }))

const client = testClient(app, { env: {} })
const answer = await client.get("/hello", { search: { name: "Ada" }, ip: "203.0.113.7" })
console.log(answer.status, JSON.stringify(await answer.json()))
// prints: 200 {"hello":"Ada","ip":"203.0.113.7"}
```

Full reference: [testing an app](https://github.com/workerstack/backend/blob/main/docs/testing.md) and
[SDK conformance](https://github.com/workerstack/clients/blob/main/docs/conformance.md), which is how the generated
clients are held to behaving alike.
