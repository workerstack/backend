import { describe, expect, it } from "vitest"
import * as z from "zod"
import { createBus } from "./bus.ts"
import { type RealtimeOptions, resolveRealtimeConfig } from "./route.ts"

const handler = (): void => {}
const identify = (): string => "u"
const onError = (): void => {}
const mw = async (_ctx: never, next: () => Promise<Response>): Promise<Response> => next()

describe("resolveRealtimeConfig: defaults", () => {
	it("applies every default: a fresh bus per route, the given path as namespace, the documented limits", () => {
		const a = resolveRealtimeConfig("/rt", { handler })
		const b = resolveRealtimeConfig("/rt", { handler })
		const { bus, ...rest } = a
		expect([rest, bus === b.bus, Object.isFrozen(a.limits)]).toEqual([
			{
				allowedOrigins: null,
				checks: { receive: null, send: null },
				handler,
				identify: null,
				limits: {
					maxBufferedBytes: 4 * 1024 * 1024,
					maxFrameBytes: 1024 * 1024,
					maxPendingFrames: 64,
					maxTopics: 128,
					slowConsumer: "close",
				},
				messages: null,
				meta: null,
				namespace: "/rt",
				onError: null,
				path: "/rt",
				use: [],
			},
			false,
			true,
		])
	})
})

describe("resolveRealtimeConfig: given options", () => {
	it("keeps what was given: the bus, the namespace, identify, messages, meta, onError, use, limits, and a normalized origin list", () => {
		const bus = createBus()
		const messages = { receive: z.string() }
		const config = resolveRealtimeConfig("/rt", {
			allowedOrigins: ["https://App.Example.com"],
			bus,
			handler,
			identify,
			limits: { maxBufferedBytes: 1, maxFrameBytes: 2, maxPendingFrames: 3, maxTopics: 4, slowConsumer: "drop" },
			messages,
			meta: { operationId: "chat.connect" },
			namespace: "chat",
			onError,
			use: [mw as never],
		})
		expect(config).toEqual({
			allowedOrigins: ["https://app.example.com"],
			bus,
			checks: { receive: expect.any(Function), send: null },
			handler,
			identify,
			limits: { maxBufferedBytes: 1, maxFrameBytes: 2, maxPendingFrames: 3, maxTopics: 4, slowConsumer: "drop" },
			messages,
			meta: { operationId: "chat.connect" },
			namespace: "chat",
			onError,
			path: "/rt",
			use: [mw],
		})
	})
})

const REFUSALS: [string, Partial<RealtimeOptions> & Record<string, unknown>, string][] = [
	["no handler", { handler: undefined }, 'realtime("/a"): handler must be a function'],
	["a handler that is not a function", { handler: "x" as never }, 'realtime("/a"): handler must be a function'],
	[
		"reconnectBuffer",
		{ reconnectBuffer: 10 },
		'realtime("/a"): reconnectBuffer is not supported. Realtime ships the WebSocket transport without resume; remove the option.',
	],
	["transports", { transports: ["sse"] }, 'realtime("/a"): only the WebSocket transport ships; remove transports.'],
	["an empty namespace", { namespace: "" }, 'realtime("/a"): namespace must be a non-empty string'],
	[
		"a namespace that is not a string",
		{ namespace: 1 as never },
		'realtime("/a"): namespace must be a non-empty string',
	],
	["a zero limit", { limits: { maxTopics: 0 } }, "realtime limits.maxTopics must be a positive integer, got 0"],
	[
		"a fractional limit",
		{ limits: { maxFrameBytes: 1.5 } },
		"realtime limits.maxFrameBytes must be a positive integer, got 1.5",
	],
	[
		"a limit that is not a number",
		{ limits: { maxPendingFrames: "8" as never } },
		"realtime limits.maxPendingFrames must be a positive integer, got 8",
	],
	[
		"an unsafe integer limit",
		{ limits: { maxBufferedBytes: 2 ** 53 } },
		"realtime limits.maxBufferedBytes must be a positive integer, got 9007199254740992",
	],
	[
		"an unknown slowConsumer policy",
		{ limits: { slowConsumer: "x" as never } },
		'realtime limits.slowConsumer must be "close" or "drop", got x',
	],
	[
		"messages that are no object",
		{ messages: 1 as never },
		'realtime("/a"): messages must be an object of { receive, send } schemas',
	],
	[
		"null messages",
		{ messages: null as never },
		'realtime("/a"): messages must be an object of { receive, send } schemas',
	],
	[
		"a null direction",
		{ messages: { receive: null as never } },
		'realtime("/a"): messages.receive must be a Standard Schema',
	],
	[
		"a direction that is no schema",
		{ messages: { send: {} as never } },
		'realtime("/a"): messages.send must be a Standard Schema',
	],
	[
		"an origin list entry with a path",
		{ allowedOrigins: ["https://a.example/path"] },
		'allowedOrigins: "https://a.example/path" is not an origin like https://example.com',
	],
]

describe("resolveRealtimeConfig: refusals", () => {
	// v0: c6e5b18d04
	// v0: 456b416b37
	it.each(REFUSALS)("refuses %s", (_name, options, message) => {
		expect(() => resolveRealtimeConfig("/a", { handler, ...options } as RealtimeOptions)).toThrow(message)
	})

	it("refuses missing options outright", () => {
		expect(() => resolveRealtimeConfig("/a", undefined as never)).toThrow(TypeError)
	})
})
