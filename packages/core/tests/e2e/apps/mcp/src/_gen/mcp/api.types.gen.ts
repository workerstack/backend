import type { Result, SDKConfig, SSEEvent } from "./api.runtime.gen.js"

export type CreateProjectsExtractRequest = { columns?: string; file?: string; instruction?: string; schema?: string; strictness?: "strict" | "balanced" | "flexible"; text?: string }
export type CreateProjectsExtractResponse200 = { files: { file_name: string; sha256: string; size: number }[]; status: string; texts: Record<string, string> }
export type CreateProjectsExtractStreamResponse200 = string
export type CreateProjectsSuggestSchemaRequest = { file?: string; text?: string }

export type HttpOptions = {
	baseURL?: string
	cookies?: Record<string, string>
	headers?: Record<string, string>
	idempotencyKey?: string
	signal?: AbortSignal
	timeout?: number
}
export type SseOptions = Omit<HttpOptions, "idempotencyKey"> & { lastEventId?: string }
export type WsOptions = { protocols?: string | string[]; reconnectToken?: string }

type ErrorField = { error_key: string; message: string; path: string }

/** backend's error envelope at one status, its error keys as literals. */
export type ErrorEnvelope<TStatus extends number, TKey extends string> = {
	error_key: TKey
	fields: Record<string, ErrorField[]>
	message: string
	status: TStatus
	status_key: string
	success: false
}

/* a call's declared errors and headers, which only its safe twin reads: a type, never a value */
declare const answer: unique symbol

/** A call's input: optional when none of its fields is required. */
type HttpArgs<I, O> = {} extends I ? [input?: I & O] : [input: I & O]

/** A REST operation: its raw overload and its value, an error status thrown; its declared errors and headers. */
type HttpCall<I, D, E = never, H = never> = {
	(input: I & HttpOptions & { raw: true }): Promise<Response>
	(...input: HttpArgs<I, HttpOptions & { raw?: false }>): Promise<D>
	readonly [answer]?: [E, H]
}

/** An event stream, sent when its iteration starts; its opening answer's declared errors. */
type HttpStream<I, V, E = never> = {
	(...input: HttpArgs<I, SseOptions>): AsyncIterable<V>
	readonly [answer]?: [E, never]
}

/** `client.safe`: every REST and stream call answering a Result, never throwing an API answer; a connection as is. */
export type HttpSafe<T> = {
	[K in keyof T]: T[K] extends HttpCall<infer I, infer D, infer E, infer H>
			? {
					(input: I & HttpOptions & { raw: true }): Promise<Result<Response, E>>
					(...input: HttpArgs<I, HttpOptions & { raw?: false }>): Promise<Result<D, E, H>>
				}
			: T[K] extends HttpStream<infer I, infer V, infer E>
				? (...input: HttpArgs<I, SseOptions>) => Promise<Result<AsyncIterable<V>, E>>
				: HttpSafe<T[K]>
}

export type ApiConfig = Omit<SDKConfig, "baseURL"> & {
	/** Default: the document's first server, /api */
	baseURL?: string
}

/** Every operation of the SDK, by its member path. */
export interface ApiOperations {
	extract: {
		once: HttpCall<{ params: { project_id: string }; form: { columns?: string; file?: Blob; instruction?: string; schema?: string; strictness?: "strict" | "balanced" | "flexible"; text?: string } }, CreateProjectsExtractResponse200>
		stream: HttpStream<{ params: { project_id: string }; form: { columns?: string; file?: Blob; instruction?: string; schema?: string; strictness?: "strict" | "balanced" | "flexible"; text?: string } }, SSEEvent>
		table: {
			once: HttpCall<{ params: { project_id: string; table_id: string }; form: { file?: Blob; text?: string } }, CreateProjectsExtractResponse200>
			stream: HttpStream<{ params: { project_id: string; table_id: string }; form: { file?: Blob; text?: string } }, SSEEvent>
		}
	}
	suggest: {
		schema: HttpCall<{ params: { project_id: string }; form: { file?: Blob; text?: string } }, CreateProjectsExtractResponse200>
	}
}

/** `client.safe`: every operation, a call answering a Result. */
export type ApiSafe = HttpSafe<ApiOperations>
