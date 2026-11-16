---
description: The exported type helpers
order: 250
---

# Type helpers

Exported from `@workerstack/backend/http`, each over the app you built (`typeof app`). This is how a test, a client or a
helper of yours stays tied to the routes rather than to a copy of their shapes.

```ts
import { httpApp, type InferRouteInput, type InferRoutePaths, type InferRoutes } from "@workerstack/backend/http"
import * as z from "zod"

const app = httpApp()
	.get("/books/:id")
	.input({ params: { id: z.string().min(1) }, search: z.object({ edition: z.string().optional() }) })
	.handler((ctx) => ctx.res.json("ok", { edition: ctx.input.search.edition, id: ctx.params.id }))

type Paths = InferRoutePaths<typeof app>
type Routes = InferRoutes<typeof app>
type BookInput = InferRouteInput<typeof app, "/books/:id", "get">

const path: Paths = "/books/:id"
declare const input: BookInput
const edition: string | undefined = input.search.edition
```

| Type                                         | What it describes                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `InferRoutes<typeof app>`                    | every path, its methods, and each one's input, output and errors                 |
| `InferRoutePaths<typeof app>`                | the paths, as a union                                                            |
| `InferRouteMethods<typeof app, Path>`        | one path's methods                                                               |
| `InferRouteInput<typeof app, Path, Method>`  | a route's validated input                                                        |
| `InferRouteOutput<typeof app, Path, Method>` | a route's output map                                                             |
| `InferRouteErrors<typeof app, Path, Method>` | a route's declared error keys                                                    |
| `InferRouteMeta<typeof app, Path, Method>`   | a route's meta                                                                   |
| `OperationCtx<"id">`                         | a route's handler `ctx`, by its declared `operationId` (from the generated slot) |
| `InferCtx<typeof app>`                       | the app's handler context                                                        |
| `InferEnv<typeof app>`                       | `ctx.env`                                                                        |
| `InferMeta<typeof app>`                      | the app-level meta                                                               |
| `InferErrorFactory<typeof app>`              | the error factory                                                                |
| `InferBasePath<typeof app>`                  | the base path, as a string                                                       |
| `InferMethods<typeof app>`                   | the methods the app serves                                                       |
