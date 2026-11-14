# Migrating from honey

backend began as `@lovrozagar/honey`. This page maps every name and import path that changed since, newest first.
Each table also drives the rename codemod, so a project can apply it in one run (see [Upgrade](#upgrade)).

## 1.0.0-rc.26: names

backend dropped its honey name. The HTTP app is `httpApp()` and its type `HttpApp`, the rest of the HTTP surface takes `Http`, a name that covers the whole package takes `Backend`, and a name that lives in one subpath loses the brand and keeps that subpath's word. The bin is `backend`. Longest rows come first, so a name is read in its own row before the bare word is: `honey` and `Honey` alone map to `backend` and `Backend`, except in the app factory forms under Exports. The wire names, the `backend-source` condition and the generated SDK names change together with `@workerstack/clients` 1.0.0-rc.27, so upgrade both at once and regenerate.

### Exports

| Before                     | After                   |
| -------------------------- | ----------------------- |
| `HoneyOpenApiOutputConfig` | `OpenApiOutputConfig`   |
| `HoneyVitePluginConfig`    | `BackendPluginConfig`   |
| `HoneyMcpOutputConfig`     | `McpOutputConfig`       |
| `HoneySdkPortsConfig`      | `BackendSdkPortsConfig` |
| `ResolvedHoneyConfig`      | `ResolvedBackendConfig` |
| `getLastHoneyConfig`       | `getLastBackendConfig`  |
| `HoneyCodegenConfig`       | `BackendCodegenConfig`  |
| `resolveHoneyConfig`       | `resolveBackendConfig`  |
| `HoneyErrorOptions`        | `HttpErrorOptions`      |
| `HoneyBuildConfig`         | `BuildConfig`           |
| `HoneyBuildPlugin`         | `BuildPlugin`           |
| `HoneyGoCliConfig`         | `BackendGoCliConfig`    |
| `instanceof Honey`         | `instanceof HttpApp`    |
| `HoneyOutHeaders`          | `HttpOutHeaders`        |
| `HoneyVitePlugin`          | `BackendPlugin`         |
| `AnyHoneyHandle`           | `AnyHttpApp`            |
| `HoneyMetaSpec`            | `HttpMetaSpec`          |
| `isHoneyPlugin`            | `isBackendPlugin`       |
| `asHoneyError`             | `asHttpError`           |
| `HoneyCodegen`             | `HttpCodegen`           |
| `HoneyContext`             | `HttpContext`           |
| `honeyVersion`             | `backendVersion`        |
| `typeof honey`             | `typeof httpApp`        |
| `class Honey`              | `class HttpApp`         |
| `honeyConfig`              | `backendConfig`         |
| `honeyPlugin`              | `backendPlugin`         |
| `HoneyStream`              | `HttpStream`            |
| `honeyError`               | `httpError`             |
| `HoneyError`               | `HttpError`             |
| `honeyFetch`               | `httpAppFetch`          |
| `HoneyGraph`               | `HttpGraph`             |
| `HoneyArgs`                | `HttpArgs`              |
| `HoneyCall`                | `HttpCall`              |
| `honeyFree`                | `backendFree`           |
| `HoneyMeta`                | `HttpMeta`              |
| `HoneySafe`                | `HttpSafe`              |
| `HoneySide`                | `BackendSide`           |
| `new Honey`                | `new HttpApp`           |
| `honey as`                 | `httpApp as`            |
| `honey_ns`                 | `backend_ns`            |
| `honeyCtx`                 | `httpCtx`               |
| `HoneyCtx`                 | `HttpCtx`               |
| `honeyDir`                 | `backendDir`            |
| `HoneyRes`                 | `HttpRes`               |
| `honey }`                  | `httpApp }`             |
| `Honey }`                  | `HttpApp }`             |
| `honeyV1`                  | `httpAppV1`             |
| `honey,`                   | `httpApp,`              |
| `Honey,`                   | `HttpApp,`              |
| `honey(`                   | `httpApp(`              |
| `honey<`                   | `httpApp<`              |
| `Honey<`                   | `HttpApp<`              |

### Removed with `@workerstack/backend/node`

These names went with the Node serve entry; nothing replaces them, because apps now run on Cloudflare Workers only:

| Removed             | Use instead                |
| ------------------- | -------------------------- |
| `HoneyServer`       | nothing; deploy to Workers |
| `HoneyServeOptions` | nothing; deploy to Workers |
| `startHoneyServer`  | nothing; deploy to Workers |

### CLI and bins

| Before                       | After                                                 |
| ---------------------------- | ----------------------------------------------------- |
| `npx honey-clients generate` | `npx --package @workerstack/clients clients generate` |
| `packages/core/bin/honey.js` | `packages/core/bin/backend.js`                        |
| `honey-clients's`            | `clients'`                                            |
| `npx honey init`             | `npx --package @workerstack/backend backend init`     |
| `honey-clients`              | `clients`                                             |
| `bin/honey.js`               | `bin/backend.js`                                      |
| `honey.js`                   | `backend.js`                                          |

### Environment

| Before                     | After                        |
| -------------------------- | ---------------------------- |
| `HONEY_REQUIRE_FORMATTERS` | `BACKEND_REQUIRE_FORMATTERS` |
| `HONEY_REQUIRE_TOOLCHAINS` | `BACKEND_REQUIRE_TOOLCHAINS` |
| `HONEY_CODEGEN_TEST_MARK`  | `BACKEND_CODEGEN_TEST_MARK`  |
| `HONEY_SUITE_RUN_ERRORS`   | `BACKEND_SUITE_RUN_ERRORS`   |
| `HONEY_CF_CONCURRENCY`     | `BACKEND_CF_CONCURRENCY`     |
| `HONEY_NO_BUN_HANDOFF`     | `BACKEND_NO_BUN_HANDOFF`     |
| `HONEY_REQUIRE_PYTHON`     | `BACKEND_REQUIRE_PYTHON`     |
| `HONEY_STACK_HOOK_LOG`     | `BACKEND_STACK_HOOK_LOG`     |
| `HONEY_BUILD_RUNTIME`      | `BACKEND_BUILD_RUNTIME`      |
| `HONEY_BUILD_TARGET`       | `BACKEND_BUILD_TARGET`       |
| `HONEY_REQUIRE_RUST`       | `BACKEND_REQUIRE_RUST`       |
| `HONEY_VITE_COMMAND`       | `BACKEND_VITE_COMMAND`       |
| `HONEY_BUN_HANDOFF`        | `BACKEND_BUN_HANDOFF`        |
| `HONEY_CF_LIVE_URL`        | `BACKEND_CF_LIVE_URL`        |
| `HONEY_WATCH_CHILD`        | `BACKEND_WATCH_CHILD`        |
| `HONEY_CF_TIMEOUT`         | `BACKEND_CF_TIMEOUT`         |
| `HONEY_E2E_RECORD`         | `BACKEND_E2E_RECORD`         |
| `HONEY_PINNED_BUN`         | `BACKEND_PINNED_BUN`         |
| `HONEY_REQUIRE_GO`         | `BACKEND_REQUIRE_GO`         |
| `HONEY_BUILD_APP`          | `BACKEND_BUILD_APP`          |
| `HONEY_E2E_REUSE`          | `BACKEND_E2E_REUSE`          |
| `HONEY_FUZZ_RUNS`          | `BACKEND_FUZZ_RUNS`          |
| `HONEY_FUZZ_SEED`          | `BACKEND_FUZZ_SEED`          |
| `HONEY_VITE_MODE`          | `BACKEND_VITE_MODE`          |
| `HONEY_CF_STORM`           | `BACKEND_CF_STORM`           |
| `HONEY_REQUIRE_`           | `BACKEND_REQUIRE_`           |
| `HONEY_E2E_APP`            | `BACKEND_E2E_APP`            |
| `HONEY_E2E_ENV`            | `BACKEND_E2E_ENV`            |
| `IMPORTS_HONEY`            | `IMPORTS_BACKEND`            |
| `HONEY_BUNDLE`             | `BACKEND_BUNDLE`             |
| `HONEY_CF_PRE`             | `BACKEND_CF_PRE`             |
| `HONEY_CF_URL`             | `BACKEND_CF_URL`             |
| `HONEY_HEADER`             | `BACKEND_HEADER`             |
| `HONEY_MUTANT`             | `BACKEND_MUTANT`             |
| `HONEY_CF_WS`              | `BACKEND_CF_WS`              |
| `HONEY_*`                  | `BACKEND_*`                  |

### Wire names and span attributes

| Before                     | After                        |
| -------------------------- | ---------------------------- |
| `x-honey-mutability-probe` | `x-backend-mutability-probe` |
| `honey.request_id`         | `backend.request_id`         |
| `x-honey-wildcard`         | `x-backend-wildcard`         |
| `honey.error_key`          | `backend.error_key`          |
| `x-honey-version`          | `x-backend-version`          |
| `x-honey-webhook`          | `x-backend-webhook`          |
| `honey.route_id`           | `backend.route_id`           |
| `x-honey-errors`           | `x-backend-errors`           |
| `honey.outcome`            | `backend.outcome`            |
| `x-honey-debug`            | `x-backend-debug`            |
| `x-honey-error`            | `x-backend-error`            |
| `x-honey-route`            | `x-backend-route`            |
| `X-HONEY-TRACE`            | `X-BACKEND-TRACE`            |
| `honey.digest`             | `backend.digest`             |
| `Honey-Mode`               | `Backend-Mode`               |
| `x-honey-`                 | `x-backend-`                 |

### Build names

| Before                  | After                     |
| ----------------------- | ------------------------- |
| `honey-no-output-check` | `backend-no-output-check` |
| `honey-build-entry`     | `backend-build-entry`     |
| `honey-source`          | `backend-source`          |
| `honey-tmp`             | `backend-tmp`             |

### Private workspace and proof Worker names

| Before              | After                 |
| ------------------- | --------------------- |
| `honey-e2e-kitchen` | `backend-e2e-kitchen` |
| `honey-cf-e2e-mcp`  | `backend-cf-e2e-mcp`  |
| `honey-monorepo`    | `backend-monorepo`    |
| `honey-cf-e2e`      | `backend-cf-e2e`      |
| `honey-e2e-$`       | `backend-e2e-$`       |
| `honey-e2e`         | `backend-e2e`         |
| `@honey/*`          | `@backend/*`          |

### Fixture and test names

| Before                               | After                                  |
| ------------------------------------ | -------------------------------------- |
| `the-build-plugin-and-the-honey-cli` | `the-build-plugin-and-the-backend-cli` |
| `honey: no crypto.randomUUID`        | `httpsdk: no crypto.randomUUID`        |
| `honey-build-object-fixture`         | `backend-build-object-fixture`         |
| `honey-build-values-fixture`         | `backend-build-values-fixture`         |
| `honey-build-queue-fixture`          | `backend-build-queue-fixture`          |
| `honey-build-cron-fixture`           | `backend-build-cron-fixture`           |
| `Code generated by honey`            | `Code generated by clients`            |
| `honey-strict-consumer-`             | `backend-strict-consumer-`             |
| `Symbol("honey.config")`             | `Symbol("http.config")`                |
| `Honey route patterns`               | `HttpApp route patterns`               |
| `honey-release-check-`               | `backend-release-check-`               |
| `no-such-module-honey`               | `no-such-module-backend`               |
| `honey-build-fixture`                | `backend-build-fixture`                |
| `honey-release-wait-`                | `backend-release-wait-`                |
| `honey-worker-entry-`                | `backend-worker-entry-`                |
| `honey-build-values`                 | `backend-build-values`                 |
| `honey-conformance`                  | `backend-conformance`                  |
| `honey-mcp-clients`                  | `backend-mcp-clients`                  |
| `honey-no-codegen-`                  | `backend-no-codegen-`                  |
| `honey.refreshAuth`                  | `http.refreshAuth`                     |
| `honey-changelog-`                   | `backend-changelog-`                   |
| `honey-namespaced`                   | `backend-namespaced`                   |
| `honey-suite-run-`                   | `backend-suite-run-`                   |
| `honey-cookie-v2`                    | `backend-cookie-v2`                    |
| `honey-consumer`                     | `backend-consumer`                     |
| `honey-surface-`                     | `backend-surface-`                     |
| `honey-plugin-`                      | `backend-plugin-`                      |
| `honey-static-`                      | `backend-static-`                      |
| `honey-client`                       | `backend-client`                       |
| `bin-honey-$`                        | `bin-backend-$`                        |
| `honey-bare-`                        | `backend-bare-`                        |
| `honey-built`                        | `backend-built`                        |
| `honey-check`                        | `backend-check`                        |
| `honey-init-`                        | `backend-init-`                        |
| `honey-lint-`                        | `backend-lint-`                        |
| `honey-named`                        | `backend-named`                        |
| `honey-oauth`                        | `backend-oauth`                        |
| `honey-side-`                        | `backend-side-`                        |
| `honey-bun-`                         | `backend-bun-`                         |
| `honey-free`                         | `backend-free`                         |
| `honey-pre-`                         | `backend-pre-`                         |
| `honey.send`                         | `http.send`                            |
| `honey-app`                          | `backend-app`                          |
| `honey-mcp`                          | `backend-mcp`                          |
| `\thoney(`                           | `\thttpApp(`                           |
| `\thoney<`                           | `\thttpApp<`                           |
| `honey://`                           | `mcp://`                               |
| `honey-$`                            | `backend-$`                            |
| `honey-`                             | `backend-`                             |

### File paths

| Before                                                                       | After                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/core/tests/e2e/apps/kitchen/src/_gen/sdk/ts/.honey-generated.json` | `packages/core/tests/e2e/apps/kitchen/src/_gen/sdk/ts/.clients-generated.json` |

### The bare word

| Before  | After     |
| ------- | --------- |
| `honey` | `backend` |
| `Honey` | `Backend` |

## 1.0.0-rc.26: exports laid out by surface

The package has no root entry any more. A surface is a top-level subpath, and that surface's Workers binding sits in
the same entry. HTTP (the app, routing, context, errors, responses, `defineErrors`, `createMiddleware`, `mergeTree`)
moved under `/http`, with every HTTP middleware and helper at `/http/<name>`. `/ws`, `/realtime`, `/mcp/*`, `/queue`
and `/cron` stay surfaces, and only package-wide tooling stays top-level: `/plugin`, `/build`, `/logger`,
`/telemetry/otel` and `/crypto`. No export changed its name in this step.

| Before                                  | After                                        |
| --------------------------------------- | -------------------------------------------- |
| `declare module "@workerstack/backend"` | `declare module "@workerstack/backend/http"` |
| `import("@workerstack/backend")`        | `import("@workerstack/backend/http")`        |
| `from "@workerstack/backend"`           | `from "@workerstack/backend/http"`           |
| `@workerstack/backend/openapi/swagger`  | `@workerstack/backend/http/openapi/swagger`  |
| `@workerstack/backend/openapi/scalar`   | `@workerstack/backend/http/openapi/scalar`   |
| `@workerstack/backend/openapi/static`   | `@workerstack/backend/http/openapi/static`   |
| `@workerstack/backend/openapi/auth`     | `@workerstack/backend/http/openapi/auth`     |
| `@workerstack/backend/openapi`          | `@workerstack/backend/http/openapi`          |
| `@workerstack/backend/request-to-curl`  | `@workerstack/backend/http/request-to-curl`  |
| `@workerstack/backend/secure-headers`   | `@workerstack/backend/http/secure-headers`   |
| `@workerstack/backend/server-timing`    | `@workerstack/backend/http/server-timing`    |
| `@workerstack/backend/cache-control`    | `@workerstack/backend/http/cache-control`    |
| `@workerstack/backend/queue/workers`    | `@workerstack/backend/queue`                 |
| `@workerstack/backend/cron/workers`     | `@workerstack/backend/cron`                  |
| `@workerstack/backend/ws/workers`       | `@workerstack/backend/ws`                    |
| `@workerstack/backend/curl-logger`      | `@workerstack/backend/http/curl-logger`      |
| `@workerstack/backend/cookie-sign`      | `@workerstack/backend/http/cookie-sign`      |
| `@workerstack/backend/pretty-json`      | `@workerstack/backend/http/pretty-json`      |
| `@workerstack/backend/ip-restrict`      | `@workerstack/backend/http/ip-restrict`      |
| `@workerstack/backend/powered-by`       | `@workerstack/backend/http/powered-by`       |
| `@workerstack/backend/request-id`       | `@workerstack/backend/http/request-id`       |
| `@workerstack/backend/user-agent`       | `@workerstack/backend/http/user-agent`       |
| `@workerstack/backend/body-limit`       | `@workerstack/backend/http/body-limit`       |
| `@workerstack/backend/rate-limit`       | `@workerstack/backend/http/rate-limit`       |
| `@workerstack/backend/compress`         | `@workerstack/backend/http/compress`         |
| `@workerstack/backend/accepts`          | `@workerstack/backend/http/accepts`          |
| `@workerstack/backend/testing`          | `@workerstack/backend/http/testing`          |
| `@workerstack/backend/timeout`          | `@workerstack/backend/http/timeout`          |
| `@workerstack/backend/webhook`          | `@workerstack/backend/http/webhook`          |
| `@workerstack/backend/static`           | `@workerstack/backend/http/static`           |
| `@workerstack/backend/cookie`           | `@workerstack/backend/http/cookie`           |
| `@workerstack/backend/proxy`            | `@workerstack/backend/http/proxy`            |
| `@workerstack/backend/range`            | `@workerstack/backend/http/range`            |
| `@workerstack/backend/input`            | `@workerstack/backend/http/input`            |
| `@workerstack/backend/i18n`             | `@workerstack/backend/http/i18n`             |
| `@workerstack/backend/tree`             | `@workerstack/backend/http/tree`             |
| `@workerstack/backend/cors`             | `@workerstack/backend/http/cors`             |
| `@workerstack/backend/csrf`             | `@workerstack/backend/http/csrf`             |
| `@workerstack/backend/etag`             | `@workerstack/backend/http/etag`             |
| `@workerstack/backend/jwt`              | `@workerstack/backend/http/jwt`              |

`workersCron`, `workersQueue` and `workersWebSocket` now come from the same entry as `defineCron`, `defineConsumer`
and `ws`. Code generated by `@workerstack/clients` 1.0.0-rc.27 and later imports `/http` and `/http/tree`, so rerun
`honey generate` after upgrading both packages together.

These subpaths were removed in 1.0.0-rc.26 with no replacement, because apps now run on Cloudflare Workers only:

| Removed                            | Use instead                                            |
| ---------------------------------- | ------------------------------------------------------ |
| `@workerstack/backend/node`        | deploy to Workers; tests call app.fetch in process     |
| `@workerstack/backend/bun`         | deploy to Workers; tests call app.fetch in process     |
| `@workerstack/backend/ws/node`     | workersWebSocket, from the WebSocket entry             |
| `@workerstack/backend/ws/bun`      | workersWebSocket, from the WebSocket entry             |
| `@workerstack/backend/ws/session`  | nothing to import; the route builder keeps it internal |
| `@workerstack/backend/queue/serve` | workersQueue, from the queue entry                     |
| `@workerstack/backend/cron/serve`  | workersCron, from the cron entry                       |

## 1.0.0-rc.23: the workerstack org

In 1.0.0-rc.23, honey moved to the workerstack org. The packages, their imports and the repository changed name.
Nothing else changed: the API, the bins, the generated code's shape and every wire name are the same as in rc.22.

| Before                                       | After                                                                                         | Since |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| `@lovrozagar/honey`                          | `@workerstack/backend`                                                                        | rc.23 |
| `@lovrozagar/honey/<subpath>`, every subpath | `@workerstack/backend/<subpath>`                                                              | rc.23 |
| `@lovrozagar/honey-clients`                  | `@workerstack/clients`                                                                        | rc.23 |
| `@lovrozagar/honey-clients/cli`              | `@workerstack/clients/cli`                                                                    | rc.23 |
| github.com/lovrozagar/honey                  | github.com/workerstack/backend (github.com/workerstack/clients for the generator, once moved) | rc.23 |

The `honey` and `honey-clients` commands, `HoneyError`, `HoneyContext` and every other exported name, the `HONEY_*`
environment variables, the `honey-source` export condition and the `x-honey-*` headers and error codes kept their
names in that release.

To move from `@lovrozagar/*`:

1. Swap the packages:

   ```sh
   npm uninstall @lovrozagar/honey @lovrozagar/honey-clients
   npm install @workerstack/backend@next
   npm install --save-dev @workerstack/clients@next
   ```

2. Replace `@lovrozagar/honey-clients` with `@workerstack/clients` in your source first, and only then replace
   `@lovrozagar/honey` with `@workerstack/backend`. Doing it in the other order turns the clients import into
   `@workerstack/backend-clients`.
3. Rerun `honey generate` and `honey-clients generate`, so the generated files import the new names.

## Upgrade

Install `@workerstack/backend` and `@workerstack/clients` at the versions above together, then rewrite the imports.
In a project that has the `~/Development/standards` checkout, the rename codemod applies every table on this page in
one run, from a clean git tree:

```sh
bun ~/Development/standards/tools/rename-brand/rename.ts . path/to/migrating-from-honey.md
```

Without it, replace each "Before" with its "After", longest first, then rerun `honey generate`.
