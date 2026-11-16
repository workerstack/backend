import type { HttpContext, WithOutput, HttpError, HttpMeta } from "@workerstack/backend/http"

export type BaseCtx = HttpContext<{ API_KEY: string; DATABASE_URL: string }> & { logger: { info: (_msg: string) => void }; user: { id: string; role: "admin" | "member" } }

declare module "@workerstack/backend/http" {
	interface HttpCodegen {
		operationId: {
			"in.all.replace": { kind: "http"; ctx: Routes["/in/all/:resourceId"]["put"]["ctx"] }
			"in.cookies.list": { kind: "http"; ctx: Routes["/in/cookies"]["get"]["ctx"] }
			"in.file.create": { kind: "http"; ctx: Routes["/in/file"]["post"]["ctx"] }
			"in.headers.list": { kind: "http"; ctx: Routes["/in/headers"]["get"]["ctx"] }
			"in.params.members.retrieve": { kind: "http"; ctx: Routes["/in/params/:orgId/members/:memberId"]["get"]["ctx"] }
			"input.createForm": { kind: "http"; ctx: Routes["/in/form"]["post"]["ctx"] }
			"input.createJson": { kind: "http"; ctx: Routes["/in/json"]["post"]["ctx"] }
			"input.none": { kind: "http"; ctx: Routes["/in/none"]["get"]["ctx"] }
			"input.search": { kind: "http"; ctx: Routes["/in/search"]["get"]["ctx"] }
			"out.binary.list": { kind: "http"; ctx: Routes["/out/binary"]["get"]["ctx"] }
			"out.csv.list": { kind: "http"; ctx: Routes["/out/csv"]["get"]["ctx"] }
			"out.html.list": { kind: "http"; ctx: Routes["/out/html"]["get"]["ctx"] }
			"out.multiStatus.create": { kind: "http"; ctx: Routes["/out/multi-status"]["post"]["ctx"] }
			"out.noContent.delete": { kind: "http"; ctx: Routes["/out/no-content/:id"]["delete"]["ctx"] }
			"out.sse.list": { kind: "http"; ctx: Routes["/out/sse"]["get"]["ctx"] }
			"out.text.list": { kind: "http"; ctx: Routes["/out/text"]["get"]["ctx"] }
			"out.xml.list": { kind: "http"; ctx: Routes["/out/xml"]["get"]["ctx"] }
			"resources.create": { kind: "http"; ctx: Routes["/methods/resource"]["post"]["ctx"] }
			"resources.delete": { kind: "http"; ctx: Routes["/methods/resource/:id"]["delete"]["ctx"] }
			"resources.list": { kind: "http"; ctx: Routes["/methods/resource"]["get"]["ctx"] }
			"resources.patch": { kind: "http"; ctx: Routes["/methods/resource/:id"]["patch"]["ctx"] }
			"resources.update": { kind: "http"; ctx: Routes["/methods/resource/:id"]["put"]["ctx"] }
			"rs.upload.create": { kind: "http"; ctx: Routes["/rs/upload"]["post"]["ctx"] }
			"rt.room": { kind: "ws"; ctx: BaseCtx }
			"status.accepted.create": { kind: "http"; ctx: Routes["/status/accepted"]["post"]["ctx"] }
			"status.created.create": { kind: "http"; ctx: Routes["/status/created"]["post"]["ctx"] }
			"status.noContent.delete": { kind: "http"; ctx: Routes["/status/no-content"]["delete"]["ctx"] }
			"status.ok.list": { kind: "http"; ctx: Routes["/status/ok"]["get"]["ctx"] }
			"stream.filtered.list": { kind: "http"; ctx: Routes["/stream/filtered"]["get"]["ctx"] }
			"ws.chat": { kind: "ws"; ctx: BaseCtx & { readonly params: { channelId: string } } }
			"ws.echo": { kind: "ws"; ctx: BaseCtx }
			"ws.joinRoom": { kind: "ws"; ctx: BaseCtx & { readonly input: { search: { roomId: string }; headers: { "x-room-token"?: string | undefined }; cookies: { session?: string | undefined } } } }
			"ws.reconnect": { kind: "ws"; ctx: BaseCtx }
			"ws.talk": { kind: "ws"; ctx: BaseCtx }
		}
	}
}

type CreateInFileRequest = { title: string; upload: string }

type CreateInFileResponse200 = { name: string; title: string }

type CreateInFormRequest = { password: string; username: string }

type CreateInFormResponse200 = { token: string }

type CreateInJsonRequest = { email: string; name: string }

type CreateInJsonResponse201 = { id: string }

type CreateMethodRequest = { name: string }

type CreateOutMultiStatuRequest = { slug: string }

type CreateOutMultiStatuResponse201 = { id: string; slug: string }

type CreateOutMultiStatuResponse409 = { error_key: "conflict"; fields: Record<string, { error_key: string; message: string; path: string }[]>; message: string; status: 409; status_key: string; success: false; vars?: Record<string, number | string> | undefined }

type CreateRsRequest = { chunks: number; fileName: string }

type CreateRsResponse202 = { uploadId: string }

type CreateStatuRequest = { task: string }

type CreateStatuRequestAa6c2c = { x: string }

type CreateStatuResponse202 = { jobId: string }

type Err400ValidationError = { error_key: "validation_error"; fields: Record<string, { error_key: string; message: string; path: string }[]>; message: string; status: 400; status_key: string; success: false; vars?: Record<string, number | string> | undefined }

type Err401Unauthorized = { error_key: "unauthorized"; fields: Record<string, { error_key: string; message: string; path: string }[]>; message: string; status: 401; status_key: string; success: false; vars?: Record<string, number | string> | undefined }

type Err404NotFound = { error_key: "not_found"; fields: Record<string, { error_key: string; message: string; path: string }[]>; message: string; status: 404; status_key: string; success: false; vars?: Record<string, number | string> | undefined }

type GetInParamsMemberResponse200 = { memberId: string; orgId: string }

type ListInCookiesResponse200 = { locale: string; valid: boolean }

type ListInHeadersResponse200 = { accepted: boolean }

type ListInNoneResponse200 = { ping: "pong" }

type ListInSearchResponse200 = { results: string[] }

type ListMethodsResponse200 = { items: string[] }

type ListOutBinaryResponse200 = unknown

type ListOutCsvResponse200 = string

type ListStatusResponse200 = { v: number }

type ReplaceInAllRequest = { data: Record<string, unknown> }

type ReplaceInAllResponse200 = { etag: string; version: number }

type ReplaceMethodsResourceResponse200 = { id: string; name: string }

type RtRoomReceive = { text: string; type: "say" } | { type: "leave" }

type RtRoomSend = { text: string; type: "said" } | { type: "left" }

type UpdateMethodsResourceRequest = { name?: string | undefined }

type WsTalkReceive = { text: string; type: "say" } | { type: "ping" }

type WsTalkSend = { text: string; type: "said" } | { type: "pong" }

export type Routes = {
	"/in/all/:resourceId": {
		put: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { data: Record<string, unknown> }; search: { version: number; force?: false | true | undefined }; headers: { "if-match": string } }; readonly params: { resourceId: string }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/all/:resourceId" }, { "application/json": { ok: ReplaceInAllResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { data: Record<string, unknown> }; search: { version: number; force?: false | true | undefined }; headers: { "if-match": string } }
			meta: { operationId: "in.all.replace" }
			output: { "application/json": { ok: ReplaceInAllResponse200 } }
		}
	}
	"/in/cookies": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { cookies: { locale: string; sid: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/cookies" }, { "application/json": { ok: ListInCookiesResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { cookies: { locale: string; sid: string } }
			meta: { operationId: "in.cookies.list" }
			output: { "application/json": { ok: ListInCookiesResponse200 } }
		}
	}
	"/in/file": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { form: { title: string; upload: import("../../../../../../../../node_modules/zod/v4/core/schemas.d.cts").File } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/file" }, { "application/json": { ok: CreateInFileResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { form: { title: string; upload: import("../../../../../../../../node_modules/zod/v4/core/schemas.d.cts").File } }
			meta: { operationId: "in.file.create" }
			output: { "application/json": { ok: CreateInFileResponse200 } }
		}
	}
	"/in/form": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { form: { password: string; username: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/form" }, { "application/json": { ok: CreateInFormResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { form: { password: string; username: string } }
			meta: { operationId: "input.createForm"; tags: ["input"] }
			output: { "application/json": { ok: CreateInFormResponse200 } }
		}
	}
	"/in/headers": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { headers: { "x-api-key": string; "x-request-id": string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/headers" }, { "application/json": { ok: ListInHeadersResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { headers: { "x-api-key": string; "x-request-id": string } }
			meta: { operationId: "in.headers.list" }
			output: { "application/json": { ok: ListInHeadersResponse200 } }
		}
	}
	"/in/json": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { email: string; name: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/json" }, { "application/json": { created: CreateInJsonResponse201 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { email: string; name: string } }
			meta: { operationId: "input.createJson"; tags: ["input"] }
			output: { "application/json": { created: CreateInJsonResponse201 } }
		}
	}
	"/in/none": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/none" }, { "application/json": { ok: ListInNoneResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "input.none"; tags: ["input"] }
			output: { "application/json": { ok: ListInNoneResponse200 } }
		}
	}
	"/in/params/:orgId/members/:memberId": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly params: { orgId: string; memberId: string }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/params/:orgId/members/:memberId" }, { "application/json": { ok: GetInParamsMemberResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "in.params.members.retrieve" }
			output: { "application/json": { ok: GetInParamsMemberResponse200 } }
		}
	}
	"/in/search": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { search: { limit: number; page: number; q?: string | undefined } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/in/search" }, { "application/json": { ok: ListInSearchResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { search: { limit: number; page: number; q?: string | undefined } }
			meta: { auth: "required"; operationId: "input.search"; tags: ["input"] }
			output: { "application/json": { ok: ListInSearchResponse200 } }
		}
	}
	"/methods/resource": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/methods/resource" }, { "application/json": { ok: ListMethodsResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "resources.list"; tags: ["methods"] }
			output: { "application/json": { ok: ListMethodsResponse200 } }
		}
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { name: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/methods/resource" }, { "application/json": { created: CreateInJsonResponse201 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { name: string } }
			meta: { operationId: "resources.create"; tags: ["methods"] }
			output: { "application/json": { created: CreateInJsonResponse201 } }
		}
	}
	"/methods/resource/:id": {
		delete: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly params: { id: string }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/methods/resource/:id" }, { "application/json": { no_content: unknown } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "resources.delete"; tags: ["methods"] }
			output: { "application/json": { no_content: unknown } }
		}
		patch: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { name?: string | undefined } }; readonly params: { id: string }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/methods/resource/:id" }, { "application/json": { ok: CreateInJsonResponse201 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { name?: string | undefined } }
			meta: { operationId: "resources.patch"; tags: ["methods"] }
			output: { "application/json": { ok: CreateInJsonResponse201 } }
		}
		put: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { name: string } }; readonly params: { id: string }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/methods/resource/:id" }, { "application/json": { ok: ReplaceMethodsResourceResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { name: string } }
			meta: { operationId: "resources.update"; tags: ["methods"] }
			output: { "application/json": { ok: ReplaceMethodsResourceResponse200 } }
		}
	}
	"/out/binary": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/binary" }, { "application/octet-stream": { ok: ListOutBinaryResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.binary.list" }
			output: { "application/octet-stream": { ok: ListOutBinaryResponse200 } }
		}
	}
	"/out/csv": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/csv" }, { "text/csv": { ok: ListOutCsvResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.csv.list" }
			output: { "text/csv": { ok: ListOutCsvResponse200 } }
		}
	}
	"/out/html": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/html" }, { "text/html": { ok: ListOutCsvResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.html.list" }
			output: { "text/html": { ok: ListOutCsvResponse200 } }
		}
	}
	"/out/multi-status": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { slug: string } }; readonly errors: { conflict: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/multi-status" }, { "application/json": { created: CreateOutMultiStatuResponse201 } }>
			errors: "conflict" | "unauthorized" | "validation_error"
			errorShapes: { conflict: null; unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null; 409: null }
			input: { json: { slug: string } }
			meta: { operationId: "out.multiStatus.create" }
			output: { "application/json": { created: CreateOutMultiStatuResponse201 } }
		}
	}
	"/out/no-content/:id": {
		delete: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly params: { id: string }; readonly errors: { not_found: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/no-content/:id" }, { "application/json": { no_content: unknown } }>
			errors: "not_found" | "unauthorized" | "validation_error"
			errorShapes: { not_found: null; unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null; 404: null }
			input: {}
			meta: { operationId: "out.noContent.delete" }
			output: { "application/json": { no_content: unknown } }
		}
	}
	"/out/sse": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/sse" }, { "text/event-stream": { ok: unknown } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.sse.list" }
			output: { "text/event-stream": { ok: unknown } }
		}
	}
	"/out/text": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/text" }, { "text/plain": { ok: ListOutCsvResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.text.list" }
			output: { "text/plain": { ok: ListOutCsvResponse200 } }
		}
	}
	"/out/xml": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/out/xml" }, { "application/xml": { ok: ListOutCsvResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "out.xml.list" }
			output: { "application/xml": { ok: ListOutCsvResponse200 } }
		}
	}
	"/rs/upload": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/rs/upload" }, { "application/json": { accepted: CreateRsResponse202 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "rs.upload.create" }
			output: { "application/json": { accepted: CreateRsResponse202 } }
		}
	}
	"/status/accepted": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { task: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/status/accepted" }, { "application/json": { accepted: CreateStatuResponse202 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { task: string } }
			meta: { operationId: "status.accepted.create" }
			output: { "application/json": { accepted: CreateStatuResponse202 } }
		}
	}
	"/status/created": {
		post: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { json: { x: string } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/status/created" }, { "application/json": { created: CreateInJsonResponse201 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { json: { x: string } }
			meta: { operationId: "status.created.create" }
			output: { "application/json": { created: CreateInJsonResponse201 } }
		}
	}
	"/status/no-content": {
		delete: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/status/no-content" }, { "application/json": { no_content: unknown } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "status.noContent.delete" }
			output: { "application/json": { no_content: unknown } }
		}
	}
	"/status/ok": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/status/ok" }, { "application/json": { ok: ListStatusResponse200 } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: {}
			meta: { operationId: "status.ok.list" }
			output: { "application/json": { ok: ListStatusResponse200 } }
		}
	}
	"/stream/filtered": {
		get: {
			ctx: WithOutput<Omit<BaseCtx, "errors"> & { readonly input: { search: { channel: string; since?: string | undefined } }; readonly errors: { unauthorized: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError; validation_error: (opts?: { cause?: unknown; fields?: Record<string, { error_key: string; message: string; path: string }[]>; headers?: Record<string, string>; vars?: Record<string, number | string> }) => HttpError }; readonly meta: Readonly<Partial<Omit<HttpMeta, keyof { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>> & { auth?: "public" | "required" | undefined; rateLimit?: "default" | "strict" | undefined }>; readonly routePattern: "/stream/filtered" }, { "text/event-stream": { ok: unknown } }>
			errors: "unauthorized" | "validation_error"
			errorShapes: { unauthorized: null; validation_error: null }
			errorsByStatus: { 400: null; 401: null }
			input: { search: { channel: string; since?: string | undefined } }
			meta: { operationId: "stream.filtered.list" }
			output: { "text/event-stream": { ok: unknown } }
		}
	}
}

export type RouteInput<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { input: infer T } ? T : never

export type RouteOutput<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { output: infer T } ? T : never

export type RouteErrors<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errors: infer T } ? T : never

export type RouteErrorShapes<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errorShapes: infer T } ? T : never

export type RouteErrorsByStatus<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { errorsByStatus: infer T } ? T : never

export type RouteMeta<TPath extends keyof Routes, TMethod extends keyof Routes[TPath] & string> = Routes[TPath][TMethod] extends { meta: infer T } ? T : never
