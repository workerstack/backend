import { describe, expect, it } from "vitest"
import * as z from "zod"
import type { StandardSchemaLike, StandardSchemaResult } from "../validation/standard-schema.ts"
import { checkTapPayload, defineTap } from "./define-tap.ts"

/** A schema whose validate answers `result`, whatever it is given. */
const answering = (result: StandardSchemaResult | Promise<StandardSchemaResult>): StandardSchemaLike => ({
	"~standard": { validate: () => result, vendor: "test", version: 1 },
})

describe("defineTap", () => {
	it("keeps the name, the schema and the handler, frozen", () => {
		const schema = z.object({ to: z.string() })
		const handler = () => {}
		const tap = defineTap("email", schema, handler)
		expect([tap.name, tap.schema, tap.handler, Object.isFrozen(tap)]).toEqual(["email", schema, handler, true])
	})

	it("refuses an empty name", () => {
		expect(() => defineTap("", z.unknown(), () => {})).toThrow(new TypeError("defineTap: a tap needs a name"))
	})
})

describe("checkTapPayload", () => {
	it("returns the schema's output", () => {
		expect(
			checkTapPayload(
				defineTap("n", z.object({ n: z.coerce.number() }), () => {}),
				{ n: "4" },
			),
		).toEqual({ value: { n: 4 } })
	})

	it.each([
		["a nested path, joined by dots", { issues: [{ message: "bad", path: ["a", 0, "b"] }] }, "a.0.b: bad"],
		["a { key } segment", { issues: [{ message: "bad", path: [{ key: "to" }] }] }, "to: bad"],
		["no path: the root", { issues: [{ message: "bad" }] }, "(root): bad"],
		["an empty path: the root", { issues: [{ message: "bad", path: [] }] }, "(root): bad"],
		["an empty issue list still fails", { issues: [] }, "(root): invalid"],
	])("names the first issue: %s", (_name, result, issue) => {
		const tap = defineTap("t", answering(result), () => {})
		expect(checkTapPayload(tap, {})).toEqual({ issue })
	})

	it("throws a TypeError for a schema that validates asynchronously", () => {
		const tap = defineTap("later", answering(Promise.resolve({ value: 1 })), () => {})
		expect(() => checkTapPayload(tap, {})).toThrow(
			new TypeError("tap later: its schema validates asynchronously; a tap's schema must validate synchronously"),
		)
	})
})
