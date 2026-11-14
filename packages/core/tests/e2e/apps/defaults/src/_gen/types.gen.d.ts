import type { HttpContext, WithOutput, HttpMeta } from "@workerstack/backend/http"

export type BaseCtx = HttpContext<unknown>

declare module "@workerstack/backend/http" {
	interface HttpCodegen {
		operationId: {
			"echo.create": { kind: "http"; ctx: Routes["/echo"]["post"]["ctx"] }
			"health.list": { kind: "http"; ctx: Routes["/health"]["get"]["ctx"] }
			"users.retrieve": { kind: "http"; ctx: Routes["/users/:id"]["get"]["ctx"] }
		}
	}
}

type CreateEchoResponse201 = string

export type Routes = {
	"/echo": {
		post: {
			ctx: WithOutput<BaseCtx & { readonly meta: Readonly<Partial<HttpMeta>>; readonly routePattern: "/echo" }, { "application/json": { created: CreateEchoResponse201 } }>
			errors: never
			input: {}
			meta: { operationId: "echo.create" }
			output: { "application/json": { created: CreateEchoResponse201 } }
		}
	}
	"/health": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly meta: Readonly<Partial<HttpMeta>>; readonly routePattern: "/health" }, never>
			errors: never
			input: {}
			meta: { operationId: "health.list" }
			output: {}
		}
	}
	"/users/:id": {
		get: {
			ctx: WithOutput<BaseCtx & { readonly params: { id: string }; readonly meta: Readonly<Partial<HttpMeta>>; readonly routePattern: "/users/:id" }, never>
			errors: never
			input: {}
			meta: { operationId: "users.retrieve" }
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
