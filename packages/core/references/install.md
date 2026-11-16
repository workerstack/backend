---
description: Install and the first app
order: 20
---

# Install

backend moved to the workerstack org in 1.0.0-rc.23, and [the migration note](https://github.com/workerstack/backend/blob/main/docs/migrating-from-honey.md)
maps each old package name to its new one. 1.0 is out as a release candidate, published under npm's `next` tag, so
an install without a tag gets a deprecated placeholder.
Add `@next` until the final release:

```sh
npm install @workerstack/backend@next
npx --package @workerstack/backend backend init
```

Apps run on Cloudflare Workers; the tooling needs Node 22.12 or later or Bun 1.3 or later. A schema library is yours to pick: backend validates
through [Standard Schema](https://standardschema.dev), so Zod, Valibot, ArkType, Effect Schema and Yup all work. The
examples here use Zod.

`backend init` writes `src/app.ts`, a Worker entry in `src/worker.ts`, a `wrangler.jsonc` and a Vite config;
`npm run dev` runs it with `wrangler dev`.
