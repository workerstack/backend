/**
 * A WebSocket route's declared messages as typed: `.messages({ receive, send })` types what onMessage gets and what
 * the socket sends; a direction left out keeps today's untyped shape. Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import * as z from "zod"
import { httpApp } from "../../src/routing/app.ts"
import type { WSContext } from "../../src/ws/contract.ts"
import { ws } from "../../src/ws/route.ts"

const TalkIn = z.discriminatedUnion("type", [
	z.object({ text: z.string(), type: z.literal("say") }),
	z.object({ type: z.literal("ping") }),
])
const TalkOut = z.discriminatedUnion("type", [
	z.object({ text: z.string(), type: z.literal("said") }),
	z.object({ type: z.literal("pong") }),
])

/** What a route's onMessage takes, read off the handler the route takes. */
type OnMessageArgs<R extends { handler: (callbacks: never) => unknown }> = Parameters<
	NonNullable<Parameters<R["handler"]>[0]["onMessage"]>
>
/** What onMessage gets. */
type MessageOf<R extends { handler: (callbacks: never) => unknown }> = OnMessageArgs<R>[2]
/** What the socket's send takes. */
type SendArgOf<R extends { handler: (callbacks: never) => unknown }> = OnMessageArgs<R>[1] extends {
	send: (data: infer D) => unknown
}
	? D
	: never

describe("ws(app, path).messages(): typed frames both ways", () => {
	it("onMessage gets receive's output, and the socket sends only send's input", () => {
		const talk = ws(httpApp<{}>(), "/talk").messages({ receive: TalkIn, send: TalkOut })
		expectTypeOf<MessageOf<typeof talk>>().toEqualTypeOf<z.output<typeof TalkIn>>()
		expectTypeOf<SendArgOf<typeof talk>>().toEqualTypeOf<z.input<typeof TalkOut>>()
		talk.handler({
			onMessage(_ctx, socket, msg) {
				expectTypeOf(msg).toEqualTypeOf<z.output<typeof TalkIn>>()
				socket.send(msg.type === "say" ? { text: msg.text, type: "said" } : { type: "pong" })
				// @ts-expect-error "shout" is no message the route sends
				socket.send({ type: "shout" })
				// @ts-expect-error a typed socket sends no raw text
				socket.send("raw")
			},
			onOpen(_ctx, socket) {
				expectTypeOf<Parameters<typeof socket.send>[0]>().toEqualTypeOf<z.input<typeof TalkOut>>()
			},
		})
	})

	it("a direction left out stays untyped, and a route without .messages() is as before", () => {
		const app = httpApp<{}>()
		ws(app, "/in-only")
			.messages({ receive: TalkIn })
			.handler({
				onMessage(_ctx, socket, msg) {
					expectTypeOf(msg).toEqualTypeOf<z.output<typeof TalkIn>>()
					expectTypeOf(socket).toEqualTypeOf<WSContext>()
				},
			})
		const outOnly = ws(app, "/out-only").messages({ send: TalkOut })
		expectTypeOf<MessageOf<typeof outOnly>>().toEqualTypeOf<ArrayBuffer | string>()
		expectTypeOf<SendArgOf<typeof outOnly>>().toEqualTypeOf<z.input<typeof TalkOut>>()
		outOnly.handler({
			onMessage(_ctx, _socket, data) {
				expectTypeOf(data).toEqualTypeOf<ArrayBuffer | string>()
			},
		})
		ws(app, "/plain").handler({
			onMessage(_ctx, socket, data) {
				expectTypeOf([socket, data]).toEqualTypeOf<(ArrayBuffer | WSContext | string)[]>()
			},
		})
		// @ts-expect-error a direction takes a Standard Schema
		ws(app, "/bad").messages({ receive: 1 })
	})
})
