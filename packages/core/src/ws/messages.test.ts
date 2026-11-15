import { describe, expect, it } from "vitest"
import * as z from "zod"
import { receiveCheck } from "./messages.ts"

const Say = z.object({ text: z.string(), type: z.literal("say") })

describe("receiveCheck: a frame as the route's receive schema reads it", () => {
	it("a JSON text frame the schema takes is its value; bad JSON, a binary frame and a miss are refused", () => {
		const check = receiveCheck(Say)
		expect([
			check('{"type":"say","text":"hi"}'),
			check("not json"),
			check(new ArrayBuffer(2)),
			check('{"type":"say"}'),
			check("[]"),
		]).toEqual([
			{ value: { text: "hi", type: "say" } },
			{ issue: "expected a JSON text frame" },
			{ issue: "expected a JSON text frame" },
			{ issue: "text: Invalid input: expected string, received undefined" },
			{ issue: "Invalid input: expected object, received array" },
		])
	})

	it("an async schema answers with a promise of the same verdict", async () => {
		const check = receiveCheck(Say.refine(async (said) => said.text !== "no", "said no"))
		await expect(
			Promise.all([check('{"type":"say","text":"hi"}'), check('{"type":"say","text":"no"}')]),
		).resolves.toEqual([{ value: { text: "hi", type: "say" } }, { issue: "said no" }])
	})
})
