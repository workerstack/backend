---
description: Static files and proxying
order: 150
---

# Static files and proxying

`staticFiles()` serves what a resolver of yours returns, so the bytes can come from a bundle, a KV store or a disk
read — backend never assumes a filesystem.

```ts
import { httpApp } from "@workerstack/backend/http"
import { cacheControl } from "@workerstack/backend/http/cache-control"
import { staticFiles } from "@workerstack/backend/http/static"

const assets = new Map<string, Blob>([["/app.js", new Blob(["console.log(1)"])]])

const app = httpApp()
	.use(cacheControl({ public: true, maxAge: 3600 }))
	.use(staticFiles({ prefix: "/assets", resolve: (_ctx, path) => assets.get(path) ?? null }))
```

`proxy()` is a handler that forwards, which is what makes an app a gateway: you own the destination call, so the
upstream is explicit and nothing is reachable by accident.

```ts
import { httpApp } from "@workerstack/backend/http"
import { proxy } from "@workerstack/backend/http/proxy"

const app = httpApp()

app.all("/billing/*").handler(
	proxy({
		destination: (_ctx, url, init) => fetch(`https://billing.internal.example.com${url}`, init),
		requestHeaders: { "x-gateway": "edge" },
		timeout: 10_000,
	}),
)
```

Full reference: [static files](https://github.com/workerstack/backend/blob/main/docs/static.md) and
[proxying and gateways](https://github.com/workerstack/backend/blob/main/docs/proxy.md).
