---
description: What backend is
order: 10
---

# Overview

A typed web framework for the Fetch API whose routes are the source of its clients. You write a route once, with its
input and output schemas; backend runs it on Cloudflare Workers, and
[`@workerstack/clients`](https://www.npmjs.com/package/@workerstack/clients) turns the same routes into an
OpenAPI 3.2 document, typed SDKs for six languages, a command-line client and an MCP server.

Nothing is inferred at runtime: the schemas you declare are what the handler receives, what the document says, and
what every generated client's types promise.

This page is the whole framework. Every TypeScript block below is type-checked by the repository's tests against this
package, so nothing here is pseudocode.
