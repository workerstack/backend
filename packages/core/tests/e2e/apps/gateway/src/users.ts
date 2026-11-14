import { httpApp } from "@workerstack/backend/http"
import * as z from "zod"

/**
 * A downstream service behind the gateway. In production it would be its own Worker reached
 * through a service binding; here the gateway's proxy calls its `fetch` directly.
 */
export const users = httpApp()

users
	.get("/users/")
	.meta({ operationId: "users.list" })
	.handler((ctx) => ctx.res.json("ok", { service: "users", users: [] }))

users
	.post("/users/")
	.meta({ operationId: "users.create" })
	.input({ json: z.object({ name: z.string() }) })
	.handler((ctx) => ctx.res.json("ok", { name: ctx.input.json.name, service: "users" }))

users
	.get("/users/:id/")
	.meta({ operationId: "users.retrieve" })
	.handler((ctx) => ctx.res.json("ok", { id: ctx.params.id, service: "users" }))
