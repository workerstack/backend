---
description: Every subpath export
order: 240
---

# Every export

Each feature is a subpath: import what the app uses, and a bundle carries nothing else. An app that never imports
`@workerstack/backend/ws` bundles no WebSocket code, and one that never imports `@workerstack/backend/http/openapi` no document
generator.

| Export                                      | What it holds                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@workerstack/backend/http`                 | `backend`, `HttpError`, `defineErrors`, `createMiddleware`, `mergeTree`, and the type helpers below                                                                                  |
| `@workerstack/backend/ws`                   | `ws(app, path)`, a WebSocket route; `workersWebSocket`                                                                                                                               |
| `@workerstack/backend/http/webhook`         | `signWebhook`                                                                                                                                                                        |
| `@workerstack/backend/cron`                 | `defineCron`, `CronConfig`, `CronDefinition`, `CronHandler`, `CronJob`, `CronSchedule`; `workersCron`, `WorkersScheduledController`                                                  |
| `@workerstack/backend/queue`                | `queueContract`, `queueMessage`, `defineConsumer`, `deadLetter`, `QueueBodyError`, `QueueDeadLetter`, and their types; `workersQueue`, `WorkersQueueOptions` and the binding's types |
| `@workerstack/backend/http/user-agent`      | `parseUserAgent`, `ParsedUserAgent`, `DeviceType`                                                                                                                                    |
| `@workerstack/backend/realtime`             | `realtime(app, path, options)`: a resumable connection over WebSocket, SSE and long-poll                                                                                             |
| `@workerstack/backend/mcp`                  | `mcp(app, path, handler, options?)`: the app's tools over MCP's Streamable HTTP, the handler `codegen.mcp` writes                                                                    |
| `@workerstack/backend/mcp/oauth`            | `oauth(options)`: `mcp()`'s opt-in OAuth 2.1 resource server (RFC 9728 metadata, Bearer challenges)                                                                                  |
| `@workerstack/backend/mcp/uploads`          | `uploads(options)`, `memoryUploadStore()`: `mcp()`'s opt-in out-of-band file uploads (the file-uploads extension's flow)                                                             |
| `@workerstack/backend/mcp/url-files`        | `urlFiles(options)`: `mcp()`'s opt-in file arguments as https URLs from listed hosts                                                                                                 |
| `@workerstack/backend/http/openapi`         | `serveOpenApi`, `serveManifest`, `generateOpenApi`, `generateManifest`, `toYaml`                                                                                                     |
| `@workerstack/backend/http/openapi/auth`    | `basic`, `credentialsMatch`: HTTP Basic in front of a served document and its docs pages                                                                                             |
| `@workerstack/backend/http/openapi/scalar`  | `scalar`, the Scalar API reference page                                                                                                                                              |
| `@workerstack/backend/http/openapi/static`  | `serveStaticOpenApi`, a document built ahead of time or living elsewhere, served without the generator                                                                               |
| `@workerstack/backend/http/openapi/swagger` | `swagger`, the Swagger UI page                                                                                                                                                       |
| `@workerstack/backend/http/i18n`            | `createErrorTranslator`, `translateError`, `interpolate`, `createInterpolator`                                                                                                       |
| `@workerstack/backend/http/input`           | `streamed()`, a request body left unread for the handler                                                                                                                             |
| `@workerstack/backend/http/range`           | `rangeResponse`, a `Range` request answered from bytes                                                                                                                               |
| `@workerstack/backend/http/cache-control`   | `cacheControl`, `httpDate`                                                                                                                                                           |
| `@workerstack/backend/http/compress`        | `compress`                                                                                                                                                                           |
| `@workerstack/backend/http/etag`            | `etag`, `notModified`                                                                                                                                                                |
| `@workerstack/backend/http/rate-limit`      | `rateLimit`, `memoryRateLimitStore`                                                                                                                                                  |
| `@workerstack/backend/http/cors`            | `cors`                                                                                                                                                                               |
| `@workerstack/backend/http/csrf`            | `csrf`                                                                                                                                                                               |
| `@workerstack/backend/http/body-limit`      | `bodyLimit`                                                                                                                                                                          |
| `@workerstack/backend/http/timeout`         | `timeout`                                                                                                                                                                            |
| `@workerstack/backend/http/ip-restrict`     | `ipRestrict`, `ipAllowed`, `isIpRule`                                                                                                                                                |
| `@workerstack/backend/http/request-id`      | `requestId`                                                                                                                                                                          |
| `@workerstack/backend/http/secure-headers`  | `secureHeaders`                                                                                                                                                                      |
| `@workerstack/backend/http/server-timing`   | `serverTiming`                                                                                                                                                                       |
| `@workerstack/backend/http/powered-by`      | `poweredBy`                                                                                                                                                                          |
| `@workerstack/backend/http/pretty-json`     | `prettyJson`                                                                                                                                                                         |
| `@workerstack/backend/logger`               | `createLogger`                                                                                                                                                                       |
| `@workerstack/backend/http/curl-logger`     | `curlLogger`, a request logged as a command that repeats it                                                                                                                          |
| `@workerstack/backend/telemetry/otel`       | `otelAdapter`                                                                                                                                                                        |
| `@workerstack/backend/http/static`          | `staticFiles`                                                                                                                                                                        |
| `@workerstack/backend/http/proxy`           | `proxy`, a route that forwards to an upstream                                                                                                                                        |
| `@workerstack/backend/http/accepts`         | `accepts`, content negotiation                                                                                                                                                       |
| `@workerstack/backend/http/cookie`          | `serializeCookie`, `parseCookieHeader`                                                                                                                                               |
| `@workerstack/backend/http/cookie-sign`     | `createCookieSigner`                                                                                                                                                                 |
| `@workerstack/backend/crypto`               | `timingSafeEqual`                                                                                                                                                                    |
| `@workerstack/backend/http/request-to-curl` | `requestToCurl`                                                                                                                                                                      |
| `@workerstack/backend/http/testing`         | `testClient`, an app called in process                                                                                                                                               |
| `@workerstack/backend/http/tree`            | the route tree's types                                                                                                                                                               |
| `@workerstack/backend/plugin`               | `backendPlugin()`, the Vite plugin that generates the app's artifacts                                                                                                                |
| `@workerstack/backend/build`                | `createBuildPlugin`, a production bundle for a deploy target                                                                                                                         |

`@workerstack/backend/http` exports `httpApp()` and the `HttpApp` class behind it, `HttpContext` and `HttpRes` (the handler's
`ctx` and its `ctx.res`), `HttpError`, `defineErrors` and `ERROR_META`, `definePreset` and `HttpPreset`, `createMiddleware` and
`mergeTree`.
