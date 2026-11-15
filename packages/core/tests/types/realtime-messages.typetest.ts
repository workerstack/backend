/**
 * A realtime route's declared messages as typed: `messages: { receive, send }` types what `conn.on("message")` gets
 * and what `conn.send`, `conn.publish` and the returned publisher take; a direction left out stays `unknown`, and a
 * route without `messages` is as before. Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import * as z from "zod"
import { realtime } from "../../src/realtime/realtime.ts"
import type { ConnContext } from "../../src/realtime/route.ts"
import { httpApp } from "../../src/routing/app.ts"

const RoomIn = z.discriminatedUnion("type", [
	z.object({ text: z.string(), type: z.literal("say") }),
	z.object({ type: z.literal("leave") }),
])
const RoomOut = z.discriminatedUnion("type", [
	z.object({ text: z.string(), type: z.literal("said") }),
	z.object({ type: z.literal("left") }),
])

describe("realtime(app, path, { messages }): typed frames both ways", () => {
	it("conn.on gets receive's output; conn.send, conn.publish and the publisher take send's input", () => {
		const room = realtime(httpApp<{}>(), "/rt/room", {
			handler: (_ctx, conn) => {
				conn.on("message", (msg) => {
					expectTypeOf(msg).toEqualTypeOf<z.output<typeof RoomIn>>()
					conn.publish("lobby", msg.type === "say" ? { text: msg.text, type: "said" } : { type: "left" })
				})
				conn.send({ type: "left" })
				// @ts-expect-error "shout" is no message the route sends
				conn.send({ type: "shout" })
				// @ts-expect-error a typed connection publishes only what it sends
				conn.publish("lobby", "raw")
			},
			messages: { receive: RoomIn, send: RoomOut },
		})
		expectTypeOf<Parameters<typeof room.publish>[1]>().toEqualTypeOf<z.input<typeof RoomOut>>()
		expectTypeOf(room.publish("lobby", { text: "hi", type: "said" })).toEqualTypeOf<Promise<void> | void>()
		expectTypeOf(room.namespace("other").publish).toEqualTypeOf<(topic: string, data: unknown) => void>()
		// @ts-expect-error the publisher sends only what the route sends
		room.publish("lobby", { type: "shout" })
	})

	it("a direction left out stays unknown, and a route without messages is as before", () => {
		const app = httpApp<{}>()
		const inOnly = realtime(app, "/in-only", {
			handler: (_ctx, conn) => {
				conn.on("message", (msg) => {
					expectTypeOf(msg).toEqualTypeOf<z.output<typeof RoomIn>>()
				})
				expectTypeOf<Parameters<typeof conn.send>[0]>().toEqualTypeOf<unknown>()
			},
			messages: { receive: RoomIn },
		})
		expectTypeOf(inOnly.publish("t", 1)).toEqualTypeOf<void>()
		const plain = realtime(app, "/plain", {
			handler: (_ctx, conn) => {
				expectTypeOf(conn).toEqualTypeOf<ConnContext>()
			},
		})
		expectTypeOf<Parameters<typeof plain.publish>>().toEqualTypeOf<[topic: string, data: unknown]>()
		// @ts-expect-error a direction takes a Standard Schema
		realtime(app, "/bad", { handler: () => {}, messages: { receive: 1 } })
	})
})
