import type { HttpContext, WithOutput, HttpMeta } from "@workerstack/backend/http"

export type BaseCtx = HttpContext<unknown>

declare module "@workerstack/backend/http" {
	interface HttpCodegen {
		operationId: {
			"articles.list": { kind: "http"; ctx: Routes["/articles"]["get"]["ctx"] }
			"articles.meta.list": { kind: "http"; ctx: Routes["/articles/meta"]["get"]["ctx"] }
			"nl.c.retrieve": { kind: "http"; ctx: Routes["/nl/c/:delivery/:url"]["get"]["ctx"] }
			"ping.list": { kind: "http"; ctx: Routes["/ping"]["get"]["ctx"] }
			"users.create": { kind: "http"; ctx: Routes["/users"]["post"]["ctx"] }
			"users.list": { kind: "http"; ctx: Routes["/users"]["get"]["ctx"] }
			"users.retrieve": { kind: "http"; ctx: Routes["/users/:id"]["get"]["ctx"] }
			"v1.openapi.spec.list": { kind: "http"; ctx: Routes["/v1/openapi/spec"]["get"]["ctx"] }
		}
	}
}

type CreateUserRequest = { name: string }

type ListArticlesResponse200 = { articles: { id: string; title: string }[]; count: number; hasMore: boolean; nextCursor: string | null }

export type Routes = {
	"/articles": {
		get: {
			ctx: WithOutput<BaseCtx & { shard: string } & { readonly input: { search: { cursor?: string } }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/articles" }, { "application/json": { ok: ListArticlesResponse200 } }>
			errors: never
			input: { search: { cursor?: string } }
			meta: { tenant: "project_id"; operationId: "articles.list"; permissions: ["articles.read"]; summary: "List articles"; worker: "origin" }
			output: { "application/json": { ok: ListArticlesResponse200 } }
		}
	}
	"/articles/meta": {
		get: {
			ctx: WithOutput<BaseCtx & { shard: string } & { readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/articles/meta" }, never>
			errors: never
			input: {}
			meta: { tenant: "project_id"; operationId: "articles.meta.list" }
			output: {}
		}
	}
	"/nl/c/:delivery/:url": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly params: { delivery: string; url: string }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/nl/c/:delivery/:url" }, never>
			errors: never
			input: {}
			meta: { operationId: "nl.c.retrieve" }
			output: {}
		}
	}
	"/ping": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/ping" }, never>
			errors: never
			input: {}
			meta: { operationId: "ping.list" }
			output: {}
		}
	}
	"/users": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/users" }, never>
			errors: never
			input: {}
			meta: { operationId: "users.list"; worker: "origin" }
			output: {}
		}
		post: {
			ctx: WithOutput<BaseCtx & { readonly input: { json: { name: string } }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/users" }, never>
			errors: never
			input: { json: { name: string } }
			meta: { operationId: "users.create"; worker: "origin" }
			output: {}
		}
	}
	"/users/:id": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly params: { id: string }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/users/:id" }, never>
			errors: never
			input: {}
			meta: { operationId: "users.retrieve"; worker: "origin" }
			output: {}
		}
	}
	"/v1/openapi/spec": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>> & { permissions?: string[]; tenant?: string; worker?: "edge" | "origin" }>; readonly routePattern: "/v1/openapi/spec" }, never>
			errors: never
			input: {}
			meta: { operationId: "v1.openapi.spec.list" }
			output: {}
		}
	}
}

export type RouteInput<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { input: infer T } ? T : never

export type RouteOutput<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { output: infer T } ? T : never

export type RouteErrors<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errors: infer T } ? T : never

export type RouteErrorShapes<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errorShapes: infer T } ? T : never

export type RouteErrorsByStatus<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errorsByStatus: infer T } ? T : never

export type RouteMeta<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { meta: infer T } ? T : never
