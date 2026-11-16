---
description: The MCP server
order: 180
---

# The MCP server

There are two ways to serve your API's tools over the Model Context Protocol, and they run in different places. The
standalone server `clients generate --target mcp` writes needs Node, and is what a local stdio install
(Claude Desktop, Claude Code, Cursor) starts. The mounted endpoint below runs wherever the app runs — Workers
included — dispatches in process, and is guarded by the app's own auth. It is the one to use remotely.

`mcp(app, path, handler, options)` mounts the handler `codegen.mcp` generated beside your app:

```ts
import { httpApp } from "@workerstack/backend/http"
import { type McpHandler, mcp } from "@workerstack/backend/mcp"

/* in the app: import { mcpHandler } from "./_gen/mcp.gen.ts" */
declare const mcpHandler: McpHandler

const app = httpApp()
mcp(app, "/mcp", mcpHandler, {
	authenticate: (request) => /^ApiKey \S+$/.test(request.headers.get("authorization") ?? ""),
})
```

Three opt-ins ride on the mount. `oauth()` makes the endpoint an OAuth 2.1 resource server (RFC 9728 metadata and
Bearer challenges), which is what ChatGPT requires; `uploads()` takes files out of band, so a large file never goes
through a tool argument; `urlFiles()` lets a file argument be an https URL from a host you list.

```ts
import { httpApp } from "@workerstack/backend/http"
import { type McpHandler, mcp } from "@workerstack/backend/mcp"
import { oauth } from "@workerstack/backend/mcp/oauth"
import { memoryUploadStore, uploads } from "@workerstack/backend/mcp/uploads"
import { urlFiles } from "@workerstack/backend/mcp/url-files"

/* in the app: import { mcpHandler } from "./_gen/mcp.gen.ts" */
declare const mcpHandler: McpHandler
declare const UPLOAD_SECRET: string

const app = httpApp()
mcp(app, "/mcp", mcpHandler, {
	authenticate: (request) => /^ApiKey \S+$/.test(request.headers.get("authorization") ?? ""),
	oauth: oauth({
		authorizationServers: ["https://auth.example.com"],
		resource: "https://mcp.example.com/mcp",
		resourceName: "Example",
		scopesSupported: ["mcp:read"],
	}),
	uploads: uploads({ secret: UPLOAD_SECRET, store: memoryUploadStore() }),
	urlFiles: urlFiles({ hosts: ["files.example.com"] }),
})
```

`memoryUploadStore()` is for one process; on Workers the store is yours (a Durable Object for the claim, R2 for the
bytes), and the MCP page shows that end to end. Only a route marked `meta({ mcp: true })` becomes a tool, and each
tool's input and output schemas come from the route's own.

Full reference: [the generated MCP server](https://github.com/workerstack/backend/blob/main/docs/mcp.md), its
[structured output](https://github.com/workerstack/backend/blob/main/docs/mcp.md#reference) included.
