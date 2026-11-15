import { describe, expect, it } from "vitest"
import * as z from "zod"
import { wsSendCheck } from "../validation/output-check.ts"
import { createBus } from "./bus.ts"
import { createRealtimePublisher, topicKey } from "./publisher.ts"

const Said = z.object({ text: z.string(), type: z.literal("said") })
const refused = "realtime publish: invalid message: text: Invalid input: expected string, received number"

/** A bus with one listener on `topic` in namespace `ns`, whose frames land in the returned list. */
function listening(ns = "/rt", topic = "room") {
	const bus = createBus()
	const frames: string[] = []
	bus.onMessage("c1", (frame) => void frames.push(frame))
	bus.subscribe("c1", topicKey(ns, topic))
	return { bus, frames }
}

describe("createRealtimePublisher: a route that declares what it sends", () => {
	it("publishes what the schema takes, throws a TypeError for a refused one, and later publishes go on", () => {
		const { bus, frames } = listening()
		const publisher = createRealtimePublisher(bus, "/rt", wsSendCheck(Said))
		publisher.publish("room", { text: "hi", type: "said" })
		const thrown = (() => {
			try {
				publisher.publish("room", { text: 1, type: "said" })
			} catch (error) {
				return error
			}
		})()
		publisher.publish("room", { text: "after", type: "said" })
		expect([frames, thrown instanceof TypeError, (thrown as Error).message]).toEqual([
			['{"text":"hi","type":"said"}', '{"text":"after","type":"said"}'],
			true,
			refused,
		])
	})

	it("returns a promise for an async check: a refusal rejects it, and publishes go out in order", async () => {
		const { bus, frames } = listening()
		const slowFirst = z.string().refine(async (s) => {
			if (s === "1") await new Promise((resolve) => setTimeout(resolve, 5))
			return s !== "bad"
		}, "refused")
		const publisher = createRealtimePublisher(bus, "/rt", wsSendCheck(slowFirst))
		const first = publisher.publish("room", "1")
		const bad = publisher.publish("room", "bad")
		const last = publisher.publish("room", "3")
		const outcomes = await Promise.allSettled([first, bad, last])
		expect([frames, outcomes.map((o) => (o.status === "rejected" ? (o.reason as Error).message : o.status))]).toEqual([
			['"1"', '"3"'],
			["fulfilled", "realtime publish: invalid message: refused", "fulfilled"],
		])
	})

	it("never checks another namespace's publishes, nor a route without a send check", () => {
		const other = listening("other")
		createRealtimePublisher(other.bus, "/rt", wsSendCheck(Said)).namespace("other").publish("room", "raw")
		const plain = listening()
		createRealtimePublisher(plain.bus, "/rt", null).publish("room", "raw")
		expect([other.frames, plain.frames]).toEqual([['"raw"'], ['"raw"']])
	})
})
