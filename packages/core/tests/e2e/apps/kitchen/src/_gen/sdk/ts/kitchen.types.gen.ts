import type { Result, SDKConfig, SSEEvent, TypedWebSocket } from "./kitchen.runtime.gen.js"

export type CreateApiV1OrganizationResponse409 = {
	error_key: "org_slug_taken"
	fields: Record<string, { error_key: string; message: string; path: string }[]>
	message: string
	status: 409
	status_key: string
	success: false
	vars?: Record<string, number | string>
}
export type Err400InvalidInput = {
	error_key: "invalid_input"
	fields: Record<string, { error_key: string; message: string; path: string }[]>
	message: string
	status: 400
	status_key: string
	success: false
	vars?: Record<string, number | string>
}
export type Err401Unauthorized = {
	error_key: "unauthorized"
	fields: Record<string, { error_key: string; message: string; path: string }[]>
	message: string
	status: 401
	status_key: string
	success: false
	vars?: Record<string, number | string>
}
export type Err403OrgLimitReached = {
	error_key: "org_limit_reached"
	fields: Record<string, { error_key: string; message: string; path: string }[]>
	message: string
	status: 403
	status_key: string
	success: false
	vars?: Record<string, number | string>
}
export type Err500ApiError = {
	error_key: "api_error"
	fields: Record<string, { error_key: string; message: string; path: string }[]>
	message: string
	status: 500
	status_key: string
	success: false
	vars?: Record<string, number | string>
}
export type ListApiEventsResponse200 = string
export type ListApiResponse200 = { id: string }

/** The order.paid webhook event */
export type OrderPaidWebhookEvent = {
	id: string
	known: true
	type: "order.paid"
	timestamp: string
	data: { amount: number; orderId: string }
}
/** The order.refunded webhook event */
export type OrderRefundedWebhookEvent = {
	id: string
	known: true
	type: "order.refunded"
	timestamp: string
	data: { orderId: string; reason: string }
}
/** An event of a type this SDK's document does not declare: a newer API's, its data as sent. */
export type UnknownWebhookEvent = { id: string; known: false; type: string; timestamp: string; data: unknown }
/** A verified delivery: check `known`, then switch on `type` for its typed `data`. */
export type WebhookEvent = OrderPaidWebhookEvent | OrderRefundedWebhookEvent | UnknownWebhookEvent

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
	[K in keyof T]: T[K] extends (...input: never[]) => TypedWebSocket
		? T[K]
		: T[K] extends HttpCall<infer I, infer D, infer E, infer H>
			? {
					(input: I & HttpOptions & { raw: true }): Promise<Result<Response, E>>
					(...input: HttpArgs<I, HttpOptions & { raw?: false }>): Promise<Result<D, E, H>>
				}
			: T[K] extends HttpStream<infer I, infer V, infer E>
				? (...input: HttpArgs<I, SseOptions>) => Promise<Result<AsyncIterable<V>, E>>
				: HttpSafe<T[K]>
}

export type KitchenConfig = SDKConfig

/** Every operation of the SDK, by its member path. */
export interface KitchenOperations {
	boundary: {
		custom: {
			list: HttpCall<
				{},
				null,
				{
					401: ErrorEnvelope<401, "unauthorized">
					403: ErrorEnvelope<403, "org_limit_reached">
					500: ErrorEnvelope<500, "api_error">
				}
			>
		}
		default: {
			list: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
		}
	}
	echoWs: {
		connect(input?: WsOptions): TypedWebSocket
	}
	echo_delete: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	echo_get: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	echo_patch: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	echo_post: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	echo_put: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	events: {
		list: HttpStream<{}, SSEEvent, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	}
	eventsLive: {
		list: HttpStream<{}, SSEEvent, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	}
	health: {
		check: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
	}
	organizations: {
		create: HttpCall<
			{},
			null,
			{
				400: ErrorEnvelope<400, "invalid_input">
				401: ErrorEnvelope<401, "unauthorized">
				403: ErrorEnvelope<403, "org_limit_reached">
				409: ErrorEnvelope<409, "org_slug_taken">
				500: ErrorEnvelope<500, "api_error">
			}
		>
		delete: HttpCall<
			{ params: { orgId: string } },
			null,
			{ 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }
		>
		list: HttpCall<{}, null, { 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }>
		retrieve: HttpCall<
			{ params: { orgId: string } },
			null,
			{ 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }
		>
	}
	realtime: {
		broadcast: {
			create: HttpCall<
				{ params: { topic: string } },
				null,
				{ 401: ErrorEnvelope<401, "unauthorized">; 500: ErrorEnvelope<500, "api_error"> }
			>
		}
		chat: {
			connect(input: { params: { roomId: string } } & WsOptions): TypedWebSocket
		}
		echo: {
			connect(input?: WsOptions): TypedWebSocket
		}
	}
	reconnectWs: {
		connect(input?: WsOptions): TypedWebSocket
	}
	root: {
		/**
		 * Root test route
		 *
		 * Test route
		 */
		list: HttpCall<
			{ search: { id: string } },
			ListApiResponse200,
			{
				400: ErrorEnvelope<400, "invalid_input">
				401: ErrorEnvelope<401, "unauthorized">
				500: ErrorEnvelope<500, "api_error">
			}
		>
	}
	v1: {
		socket: {
			connect(input?: WsOptions): TypedWebSocket
		}
	}
}

/** `client.safe`: every operation, a call answering a Result. */
export type KitchenSafe = HttpSafe<KitchenOperations>
