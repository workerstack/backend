/**
 * The server side of one ws route connection: the route's callbacks run on one ordered lane (open,
 * then messages, then close), each contained, with a cap on messages waiting for the handler.
 * A plain module: importing it registers nothing (H23).
 */
import { createEventQueue, invokeUser, type InvokeLogger } from "../realtime/invoke-user.ts"
import type { WSContext, WSHandler } from "./contract.ts"
import { checkedSocket, type FrameCheck, type FrameVerdict, invalidMessage, type SendCheck } from "./messages.ts"
import { CLOSE_INTERNAL, CLOSE_INVALID_DATA, CLOSE_POLICY } from "./shared.ts"

/** Messages one connection may have waiting for its handler; more close it with 1008. */
export const WS_PENDING_MAX = 1024

/**
 * What one WebSocket connection's session needs: the route's callbacks, its request context, and an optional logger
 * and reconnect token.
 */
export type WsSessionOptions = {
	/** The route's own callbacks; each receives the route's request context first. */
	callbacks: WSHandler<unknown>
	/** The request context passed as the first argument to every callback. */
	ctx: unknown
	/** Where a failure is logged when the route has no `onError`, or when `onError` itself fails; `null` logs nothing. */
	log: InvokeLogger | null
	/** The check of each inbound frame against the route's `receive` schema; `null` when it declares none. */
	receive: FrameCheck | null
	/** The client's `reconnect_token`: `onReconnect` runs in place of `onOpen` when both exist. */
	reconnectToken: string | null
	/** The route path, attached to log lines for a failing callback. */
	route: string
	/** The check of each message the route sends against its `send` schema; `null` when none runs. */
	send: SendCheck | null
}

type Run = (phase: string, ws: WSContext, fn: () => unknown) => boolean | Promise<boolean>
type Handle = NonNullable<WSHandler<unknown>["onMessage"]>

/**
 * The socket each callback holds: the runtime's own when the route checks no sends, else one per runtime socket
 * whose sends are checked, so a callback can keep it and compare it later. A refused send is logged, and the socket
 * closes 1011: the route broke its own contract.
 */
function heldSockets(send: SendCheck | null, log: InvokeLogger | null, route: string): (ws: WSContext) => WSContext {
	if (send === null) return (ws) => ws
	const sockets = new WeakMap<WSContext, WSContext>()
	const refuse = (ws: WSContext) => (issue: string) => {
		try {
			log?.error?.({ phase: "websocket send", route }, `ws send: invalid message: ${issue}`)
		} catch {
			/* a broken logger must not stop the close */
		}
		ws.close(CLOSE_INTERNAL, "invalid outgoing message")
	}
	return (ws) => {
		const held = sockets.get(ws) ?? checkedSocket(ws, send, refuse(ws))
		sockets.set(ws, held)
		return held
	}
}

/**
 * Each frame's turn on the lane, checked inside the turn when the route declares `receive`, so order holds. A refused
 * frame: onError hears invalid_message, the socket closes 1007, and no later frame runs.
 */
function frameTurns(receive: FrameCheck | null, onError: WSHandler<unknown>["onError"], ctx: unknown, run: Run) {
	let refused = false
	const deliver = (ws: WSContext, verdict: FrameVerdict, handle: Handle) => {
		if ("value" in verdict) return run("message", ws, () => handle(ctx, ws, verdict.value as never))
		refused = true
		const reason = `invalid message: ${verdict.issue}`
		const heard = onError ? run("message", ws, () => onError(ctx, ws, invalidMessage(verdict.issue))) : true
		const close = () => ws.close(CLOSE_INVALID_DATA, reason)
		return typeof heard === "boolean" ? close() : heard.then(close)
	}
	const turn = (ws: WSContext, data: ArrayBuffer | string, handle: Handle) => {
		if (refused) return
		if (receive === null) return run("message", ws, () => handle(ctx, ws, data))
		const verdict = receive(data)
		return verdict instanceof Promise
			? verdict.then((checked) => deliver(ws, checked, handle))
			: deliver(ws, verdict, handle)
	}
	return { refused: () => refused, turn }
}

/** The adapter-facing handler for one connection. */
export function createWsSession(options: WsSessionOptions): WSHandler<unknown> {
	const { callbacks, ctx, log, receive, reconnectToken, route, send } = options
	const { onClose, onError, onMessage, onOpen, onReconnect } = callbacks
	const queue = createEventQueue()
	const socketOf = heldSockets(send, log, route)
	let pending = 0

	const handled = (): void => {
		pending--
	}

	const run: Run = (phase, ws, fn) =>
		invokeUser(fn, {
			fields: { route },
			log,
			onError: onError ? (error) => onError(ctx, ws, error) : null,
			phase: `websocket ${phase}`,
		})
	const frames = frameTurns(receive, onError, ctx, run)

	return {
		onClose: (_ctx, raw, code, reason) => {
			const ws = socketOf(raw)
			if (onClose) void queue.push(() => run("close", ws, () => onClose(ctx, ws, code, reason)))
		},
		/* a transport error: onError hears it once; without one, it is logged */
		onError: (_ctx, raw, error) => {
			const ws = socketOf(raw)
			void queue.push(() =>
				invokeUser(() => (onError ? onError(ctx, ws, error) : Promise.reject(error)), {
					fields: { route },
					log,
					phase: "websocket error",
				}),
			)
		},
		onMessage: (_ctx, raw, data) => {
			if (!onMessage || frames.refused()) return
			const ws = socketOf(raw)
			if (pending >= WS_PENDING_MAX) return ws.close(CLOSE_POLICY, "too many pending messages")
			pending++
			void queue.push(() => {
				const ran = frames.turn(ws, data, onMessage)
				return ran instanceof Promise ? ran.then(handled) : handled()
			})
		},
		onOpen: (_ctx, raw) => {
			const ws = socketOf(raw)
			/* an empty token is no token */
			if (reconnectToken && onReconnect) {
				void queue.push(() => run("open", ws, () => onReconnect(ctx, ws, reconnectToken)))
			} else if (onOpen) {
				void queue.push(() => run("open", ws, () => onOpen(ctx, ws)))
			}
		},
	}
}
