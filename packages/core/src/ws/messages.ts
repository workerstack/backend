/**
 * A WebSocket route's declared messages (`.messages({ receive, send })`): their types, and the check of each inbound
 * frame against `receive`. Every frame is one JSON text frame. Receiving is input, so its check always runs; the
 * check of what the route sends is the output check's (`#output-check`). A plain module: importing it registers
 * nothing (H23).
 */
import { EK, HttpError } from "../errors/error.ts"
import type { WSContext } from "./contract.ts"
import {
	describeIssue,
	type InferInput,
	type InferOutput,
	type StandardSchemaLike,
	type StandardSchemaResult,
} from "../validation/standard-schema.ts"

/** One schema per direction, named from the server's side: what it receives, and what it sends. */
export type WsMessages = {
	/** Each inbound frame, parsed as JSON; a frame it refuses closes the socket with 1007. */
	readonly receive?: StandardSchemaLike
	/** Each message the route sends; checked while the output check is on. */
	readonly send?: StandardSchemaLike
}

/** What a WebSocket route documents beside its upgrade: its declared messages, and whether `realtime()` made it. */
export type WsDoc = {
	/** what it receives and sends; `null` for an untyped socket */
	readonly messages: WsMessages | null
	/** `true` for a `realtime()` route, which the document marks `x-realtime` */
	readonly realtime: boolean
}

/** What an untyped route's `onMessage` gets: text as a string, binary as an `ArrayBuffer`. */
export type UntypedFrame = ArrayBuffer | string

/** What an untyped socket sends: bytes or text as they are, any other value as JSON. */
export type UntypedSend = ArrayBuffer | Uint8Array | object | string

/** What `onMessage` gets: the receive schema's output, else the raw frame. */
export type ReceiveOf<M> = M extends { readonly receive: infer S extends StandardSchemaLike }
	? InferOutput<S>
	: UntypedFrame

/** What the socket's `send` takes: the send schema's input, else any untyped message. */
export type SendOf<M> = M extends { readonly send: infer S extends StandardSchemaLike } ? InferInput<S> : UntypedSend

/** A frame's verdict: the value `onMessage` gets, or the issue the socket closes with. */
export type FrameVerdict = { readonly value: unknown } | { readonly issue: string }

/** The check of one inbound frame; a promise only for an async schema. */
export type FrameCheck = (frame: UntypedFrame) => FrameVerdict | Promise<FrameVerdict>

/** The check of one outgoing message: `null` when the send schema takes it, else the issue; a promise only when async. */
export type SendCheck = (data: unknown) => string | null | Promise<string | null>

const NOT_JSON: FrameVerdict = { issue: "expected a JSON text frame" }

function verdictOf(result: StandardSchemaResult): FrameVerdict {
	const issue = result.issues?.[0]
	return issue === undefined ? { value: result.value } : { issue: describeIssue(issue) }
}

/** The check of each inbound frame against `schema`: a JSON text frame it takes, else the first issue. */
export function receiveCheck(schema: StandardSchemaLike): FrameCheck {
	return (frame) => {
		if (typeof frame !== "string") return NOT_JSON
		let data: unknown
		try {
			data = JSON.parse(frame)
		} catch {
			/* a frame that is no JSON is the client's mistake, answered as any refused frame */
			return NOT_JSON
		}
		const result = schema["~standard"].validate(data)
		return result instanceof Promise ? result.then(verdictOf) : verdictOf(result)
	}
}

/** The error `onError` hears for a refused frame: `invalid_message`, its issue under `vars.issue`. */
export function invalidMessage(issue: string): HttpError {
	return new HttpError({ errorKey: EK.invalid_message, status: "bad_request", vars: { issue } })
}

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const noop = (): void => {}

/**
 * `check` each message, then `deliver` it or `refuse` it, in the order given: a message waits behind an earlier pending
 * check. One answered at once with nothing pending is settled at once, and a throw from `deliver` or `refuse` reaches
 * the caller; otherwise the returned promise settles with it. A check that rejects refuses its message. The lane never
 * stops: what follows a refusal is the caller's choice.
 */
export function inOrder<T>(
	check: (message: T) => string | null | Promise<string | null>,
	deliver: (message: T) => void,
	refuse: (issue: string) => void,
): (message: T) => void | Promise<void> {
	/* settles once the last message whose check was pending is settled; null when none is pending */
	let turn: Promise<void> | null = null
	const settle = (message: T, issue: string | null): void => (issue === null ? deliver(message) : refuse(issue))
	return (message) => {
		const verdict = check(message)
		if (turn === null && !(verdict instanceof Promise)) return settle(message, verdict)
		/* a check that rejects refuses its message: nothing reads what an unchecked send would have been */
		const mine = Promise.all([turn, verdict]).then(
			([, issue]) => settle(message, issue),
			(error: unknown) => refuse(`send check failed: ${reasonOf(error)}`),
		)
		const settled = mine.then(noop, noop)
		turn = settled
		void settled.then(() => {
			if (turn === settled) turn = null
		})
		return mine
	}
}

/**
 * Each message checked in order (`inOrder`), until the first refusal: `refuse` hears why, once, and no later message
 * goes out. A message that passed its check but fails to go out after its turn waited is refused too, since its
 * sender has moved on.
 */
export function untilRefused<T>(
	check: (message: T) => string | null | Promise<string | null>,
	deliver: (message: T) => void,
	refuse: (issue: string) => void,
): (message: T) => void {
	let refused = false
	const reportRefusal = (issue: string): void => {
		if (refused) return
		refused = true
		refuse(issue)
	}
	const lane = inOrder(check, (message: T) => (refused ? undefined : deliver(message)), reportRefusal)
	return (message) => {
		if (refused) return
		void lane(message)?.catch((error: unknown) => reportRefusal(`send failed: ${reasonOf(error)}`))
	}
}

/**
 * `ws` with each send checked first, in the order sent: a send waits behind an earlier pending check. A refused
 * message is not sent; `refuse` hears why, once, and no later send goes out.
 */
export function checkedSocket(ws: WSContext, check: SendCheck, refuse: (issue: string) => void): WSContext {
	const socket: WSContext = Object.create(ws)
	socket.send = untilRefused(check, (data) => ws.send(data as UntypedSend), refuse)
	return socket
}
