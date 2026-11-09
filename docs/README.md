# honey docs

honey is a typed web framework for the Fetch API, with code generation for clients in six languages, a command-line
client and an MCP server. These pages cover each part, each with an example the docs' tests compile.

## Getting started

- [Migrating from 0.7](migration.md)
- [The app](app-settings.md)
- [Routing](routing.md)
- [Input and output](input-output.md)
- [Middleware](middleware.md)
- [Testing an app](testing.md)
- [Package exports](packages.md)

## The server

- [Streaming](streaming.md)
- [WebSockets, realtime and SSE](realtime.md)
- [Cookies](cookies.md)
- [Static files](static.md)
- [Proxying and gateways](proxy.md)
- [Logging, errors and tracing](observability.md)
- [Internationalization](i18n.md)
- [Crypto](crypto.md)
- [JWT](jwt.md)
- [User agent](user-agent.md)
- [Cron](cron.md)
- [Queue](queue.md)
- [The OpenAPI document](openapi.md)
- [The build plugin](plugin.md)

## Generated clients

`@workerstack/clients` generates them, and its pages live in [its repository](https://github.com/workerstack/clients):

- [Code generation](https://github.com/workerstack/clients/blob/main/docs/codegen.md)
- [Generated clients](https://github.com/workerstack/clients/blob/main/docs/client.md)
- [SDK recipes](https://github.com/workerstack/clients/blob/main/docs/sdk-recipes.md)
- [The generated CLI](https://github.com/workerstack/clients/blob/main/docs/cli.md)
- [Releasing a generated CLI](https://github.com/workerstack/clients/blob/main/docs/cli-release.md)
- [The generated MCP server, and mounting it in an app](mcp.md)
- [SDK conformance](https://github.com/workerstack/clients/blob/main/docs/conformance.md)

## Capabilities new in 1.0

- [Open media types and response headers](capabilities/media-types.md)
- [Range requests](capabilities/range.md)
- [Cache-Control](capabilities/cache-control.md)
- [Rate limiting](capabilities/rate-limit.md)
- [Compression](capabilities/compress.md)
- [Problem+JSON errors](capabilities/problem-json.md)
- [Webhooks](capabilities/webhooks.md)
- [Realtime resume](capabilities/realtime-resume.md)
