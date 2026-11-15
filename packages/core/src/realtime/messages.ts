/**
 * A realtime route's declared messages (`messages: { receive, send }`): what they type on the connection, and the
 * checks the session runs. Each inbound frame is checked against `receive` at its turn; what the route sends is the
 * output check's (`#output-check`). A plain module: importing it registers nothing (H23).
 */
import { wsSendCheck } from "#output-check"
import type { InferInput, InferOutput, StandardSchemaLike } from "../validation/standard-schema.ts"
import { type FrameCheck, receiveCheck, type SendCheck, untilRefused, type WsMessages } from "../ws/messages.ts"
import type { InvokeLogger } from "./invoke-user.ts"

/** What `conn.on("message")` gets: the receive schema's output, else the frame parsed as JSON. */
export type RealtimeReceiveOf<M> = M extends { readonly receive: infer S extends StandardSchemaLike }
	? InferOutput<S>
	: unknown

/** What `conn.send`, `conn.publish` and the route's publisher take: the send schema's input, else any JSON value. */
export type RealtimeSendOf<M> = M extends { readonly send: infer S extends StandardSchemaLike }
	? InferInput<S>
	: unknown

/** The checks a realtime route runs: `null` for a direction it does not declare, or a send check that is off. */
export type RealtimeChecks = {
	readonly receive: FrameCheck | null
	readonly send: SendCheck | null
}

const NONE: RealtimeChecks = { receive: null, send: null }

/** Refuse a `messages` option that is no object of Standard Schemas. */
function checkMessages(path: string, messages: unknown): asserts messages is WsMessages {
	if (typeof messages !== "object" || messages === null) {
		throw new TypeError(`realtime("${path}"): messages must be an object of { receive, send } schemas`)
	}
	for (const direction of ["receive", "send"] as const) {
		const schema = (messages as Record<string, unknown>)[direction]
		if (schema !== undefined && typeof (schema as { "~standard"?: unknown })?.["~standard"] !== "object") {
			throw new TypeError(`realtime("${path}"): messages.${direction} must be a Standard Schema`)
		}
	}
}

/** The checks for a route's `messages` option; throws a `TypeError` for a malformed one. */
export function realtimeChecks(path: string, messages: unknown): RealtimeChecks {
	if (messages === undefined) return NONE
	checkMessages(path, messages)
	return {
		receive: messages.receive === undefined ? null : receiveCheck(messages.receive),
		send: messages.send === undefined ? null : wsSendCheck(messages.send),
	}
}

/** One message a connection sends: to its own socket when `topic` is `null`, else published on `topic`. */
export type Outgoing = { readonly payload: unknown; readonly topic: string | null }

type LaneOptions = {
	readonly check: SendCheck | null
	readonly deliver: (out: Outgoing) => void
	readonly fields: Record<string, unknown>
	readonly log: InvokeLogger | null
	/** Close the connection for a refused message. */
	readonly close: () => void
}

/**
 * A connection's sends and publishes on one lane, each checked in the order made. A refused one is not delivered: it
 * is logged, the connection closes, and nothing later goes out. Without a send check, each is delivered at once.
 */
export function connectionLane(options: LaneOptions): (out: Outgoing) => void {
	const { check, close, deliver, fields, log } = options
	if (check === null) return deliver
	return untilRefused(
		(out: Outgoing) => check(out.payload),
		deliver,
		(issue) => {
			try {
				log?.error?.({ ...fields, phase: "realtime send" }, `realtime send: invalid message: ${issue}`)
			} catch {
				/* a broken logger must not keep the connection open */
			}
			close()
		},
	)
}
