---
description: Typed errors and problem+json
order: 80
---

# Errors

`defineErrors` maps your own keys to HTTP statuses and gives you the factory a route throws from. A route declares
which keys it can throw with `.errors()`, and those keys are what the document and every generated client know
about.

```ts
import { defineErrors, httpApp } from "@workerstack/backend/http"

const errors = defineErrors({ out_of_stock: "conflict" })

const app = httpApp().errorFormat("problem+json")

app
	.post("/orders")
	.errors(errors, "out_of_stock")
	.handler(() => {
		throw errors.out_of_stock()
	})
```

`errorFormat("problem+json")` answers RFC 9457 Problem Details instead of backend's own body. Anything thrown becomes a
`HttpError`; `onError` sees it first, and `ERROR_META` is the symbol a thrown value carries its status under, so a
value from elsewhere can present itself as one. Under either format, `defaultErrorFormatter` gets the default body (the
Problem Details document under `problem+json`) and its answer keeps that content type, while `payloadErrorFormatter`
shapes the body of an error `defineErrors` gave a payload schema, which always answers `application/json`.

```ts
import { defineErrors, ERROR_META, type ErrorFormatter, HttpError, httpApp } from "@workerstack/backend/http"

const errors = defineErrors({ db_timeout: "service_unavailable" })

/* the body an error answers with: the default shape, plus whatever your API adds to it */
const formatter: ErrorFormatter = (error, defaultShape) => ({ ...defaultShape, retriable: error.status >= 500 })

const app = httpApp()
	.errorFactory(errors)
	.errorFormat("problem+json")
	.defaultErrorFormatter(formatter)
	.onError((error, ctx) => {
		if (error instanceof HttpError && error.errorKey === "db_timeout") return ctx.jsonFromError(error)
		return undefined
	})

app.get("/").handler((ctx) => ctx.res.text("ok", "up"))

/* a thrown value of your own, carrying the status backend should answer with */
const refusal = Object.assign(new Error("nope"), { [ERROR_META]: { errorKey: "forbidden", status: 403 } })
```

Full reference: [problem+json](https://github.com/workerstack/backend/blob/main/docs/capabilities/problem-json.md) and
[logging, errors and tracing](https://github.com/workerstack/backend/blob/main/docs/observability.md).
