import { describe, expect, it, vi } from "vitest"
import * as z from "zod"
import { HttpError } from "../errors/error.ts"
import { type RawSocket, type WSContext, WSContextImpl, type WSHandler } from "./contract.ts"
import { wsSendCheck } from "../validation/output-check.ts"
import { type FrameCheck, receiveCheck, type SendCheck } from "./messages.ts"
import { createWsSession } from "./session.ts"

const ctx = { user: "u1" }
/* checks whose first answer comes late, and one that rejects (a string after an Error) */
const slowFirst: FrameCheck = (frame) =>
	frame === "1" ? new Promise((resolve) => setTimeout(() => resolve({ value: "one" }), 5)) : { value: String(frame) }
const slowFirstSend: SendCheck = (data) =>
	data === "1" ? new Promise((resolve) => setTimeout(() => resolve(null), 5)) : null
const failing: SendCheck = (data) => Promise.reject(data === "late" ? "late" : new Error("boom"))
const Say = z.object({ text: z.string(), type: z.literal("say") })

/** A socket whose closes land in `events` beside what the callbacks record. */
function socket(events: unknown[]): WSContext {
	return {
		close: (code, reason) => void events.push(["close", code, reason]),
		raw: null,
		readyState: 1,
		send: () => {},
	}
}

function typed(callbacks: WSHandler<typeof ctx, unknown>, receive: FrameCheck | null, send: SendCheck | null = null) {
	const log = { error: vi.fn() }
	const handler = createWsSession({
		callbacks: callbacks as WSHandler<unknown>,
		ctx,
		log,
		receive,
		reconnectToken: null,
		route: "/talk",
		send,
	})
	return { handler, log }
}

describe("createWsSession: a route that declares what it receives", () => {
	it("hands onMessage the schema's value; a refused frame calls onError with invalid_message, then closes 1007, and no later frame runs", async () => {
		const events: unknown[] = []
		const ws = socket(events)
		const { handler } = typed(
			{
				onError: async (_c, _ws, error) => {
					await Promise.resolve()
					const e = error as HttpError
					events.push(["error", e instanceof HttpError, e.errorKey, e.status, e.vars])
				},
				onMessage: (_c, _ws, msg) => void events.push(["message", msg]),
			},
			/* async, so all three frames wait on the lane and the last one reaches its turn after the refusal */
			receiveCheck(Say.refine(async () => true)),
		)
		handler.onMessage?.(undefined as never, ws, '{"type":"say","text":"hi"}')
		handler.onMessage?.(undefined as never, ws, '{"type":"say"}')
		handler.onMessage?.(undefined as never, ws, '{"type":"say","text":"late"}')
		await vi.waitFor(() => expect(events).toHaveLength(3))
		await new Promise((resolve) => setTimeout(resolve, 5))
		const issue = "text: Invalid input: expected string, received undefined"
		expect(events).toEqual([
			["message", { text: "hi", type: "say" }],
			["error", true, "invalid_message", 400, { issue }],
			["close", 1007, `invalid message: ${issue}`],
		])
	})

	it("cuts a long issue's close reason to 123 UTF-8 bytes", async () => {
		const closed: [number | undefined, string | undefined][] = []
		const raw: RawSocket = { close: (code, reason) => void closed.push([code, reason]), readyState: 1, send: () => {} }
		const { handler } = typed({ onMessage: () => {} }, receiveCheck(z.string().min(1, "é".repeat(100))))
		handler.onMessage?.(undefined as never, new WSContextImpl(raw), '""')
		await vi.waitFor(() => expect(closed).toHaveLength(1))
		const [[code, reason]] = closed as [[number, string]]
		expect([code, new TextEncoder().encode(reason).length <= 123, reason.startsWith("invalid message: éé")]).toEqual([
			1007,
			true,
			true,
		])
	})

	it("keeps frame order when a frame's check is async", async () => {
		const seen: unknown[] = []
		const { handler } = typed({ onMessage: (_c, _ws, msg) => void seen.push(msg) }, slowFirst)
		const ws = socket([])
		handler.onMessage?.(undefined as never, ws, "1")
		handler.onMessage?.(undefined as never, ws, "2")
		await vi.waitFor(() => expect(seen).toHaveLength(2))
		expect(seen).toEqual(["one", "2"])
	})
})

/** A raw socket whose sends and closes land in `events`. */
function rawSocket(events: unknown[]): RawSocket {
	return {
		close: (code, reason) => void events.push(["close", code, reason]),
		readyState: 1,
		send: (data) => void events.push(["send", data]),
	}
}

describe("createWsSession: a route that declares what it sends", () => {
	const Said = z.object({ text: z.string(), type: z.literal("said") })

	it("sends what the schema takes; a refused message is not sent, is logged, closes 1011, and no later send goes out", async () => {
		const events: unknown[] = []
		const { handler, log } = typed(
			{
				onOpen: (_c, ws) => {
					ws.send({ text: "hi", type: "said" })
					ws.send({ text: 1, type: "said" })
					ws.send({ text: "late", type: "said" })
				},
			},
			null,
			wsSendCheck(Said),
		)
		handler.onOpen?.(undefined as never, new WSContextImpl(rawSocket(events)))
		await vi.waitFor(() => expect(events).toHaveLength(2))
		await new Promise((resolve) => setTimeout(resolve, 5))
		expect([events, log.error.mock.calls]).toEqual([
			[
				["send", '{"text":"hi","type":"said"}'],
				["close", 1011, "invalid outgoing message"],
			],
			[
				[
					{ phase: "websocket send", route: "/talk" },
					"ws send: invalid message: text: Invalid input: expected string, received number",
				],
			],
		])
	})
})

describe("createWsSession: a route's checked sends, in order", () => {
	it("keeps send order when a check is async, and every callback holds the same socket", async () => {
		const events: unknown[] = []
		const held: WSContext[] = []
		const { handler } = typed(
			{
				onMessage: (_c, ws) => {
					held.push(ws)
					ws.send("2")
				},
				onOpen: (_c, ws) => {
					held.push(ws)
					ws.send("1")
				},
			},
			null,
			slowFirstSend,
		)
		const ws = new WSContextImpl(rawSocket(events))
		handler.onOpen?.(undefined as never, ws)
		handler.onMessage?.(undefined as never, ws, "go")
		await vi.waitFor(() => expect(events).toHaveLength(2))
		expect([events, held[0] === held[1]]).toEqual([
			[
				["send", "1"],
				["send", "2"],
			],
			true,
		])
	})

	it("refuses a message whose async check rejects, and closes though the logger throws", async () => {
		const events: unknown[] = []
		const { handler, log } = typed(
			{
				onOpen: (_c, ws) => {
					ws.send({ text: "hi", type: "said" })
					ws.send("late")
				},
			},
			null,
			failing,
		)
		log.error.mockImplementation(() => {
			throw new Error("logger down")
		})
		handler.onOpen?.(undefined as never, new WSContextImpl(rawSocket(events)))
		await vi.waitFor(() => expect(events).toHaveLength(1))
		await new Promise((resolve) => setTimeout(resolve, 5))
		expect([events, log.error.mock.calls.map(([, message]) => message)]).toEqual([
			[["close", 1011, "invalid outgoing message"]],
			["ws send: invalid message: send check failed: boom"],
		])
	})
})
