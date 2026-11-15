import { describe, expect, it } from "vitest"
import { withDiscriminator } from "./discriminator.ts"

const member = (tag: unknown, extra: Record<string, unknown> = {}) => ({
	properties: { kind: { const: tag }, ...extra },
	required: ["kind"],
	type: "object",
})

describe("withDiscriminator: a tagged union's discriminator", () => {
	it("names the property every member requires with a const of its own, under oneOf or anyOf", () => {
		const oneOf = { oneOf: [member("a"), member("b")] }
		const anyOf = { anyOf: [member(1), member(2)] }
		expect([withDiscriminator(oneOf), withDiscriminator(anyOf)]).toEqual([
			{ ...oneOf, discriminator: { propertyName: "kind" } },
			{ ...anyOf, discriminator: { propertyName: "kind" } },
		])
	})

	it("skips a property a member leaves optional or holds no const for, and takes the next one that qualifies", () => {
		const schema = {
			oneOf: [
				{ properties: { id: { const: "x" }, kind: { const: "a" } }, required: ["kind"], type: "object" },
				{ properties: { id: { type: "string" }, kind: { const: "b" } }, required: ["id", "kind"], type: "object" },
			],
		}
		expect(withDiscriminator(schema).discriminator).toEqual({ propertyName: "kind" })
	})

	it("leaves alone one member, shared consts, a boolean member, a member without required, and no union", () => {
		const schemas = [
			{ oneOf: [member("a")] },
			{ oneOf: [member("a"), member("a", { n: { type: "number" } })] },
			{ anyOf: [member("a"), true] },
			{ anyOf: [member("a"), { properties: { kind: { const: "b" } }, type: "object" }] },
			{ anyOf: [{ type: "string" }, { type: "number" }] },
			{ type: "object" },
		]
		expect(schemas.map((schema) => withDiscriminator(schema) === schema)).toEqual([true, true, true, true, true, true])
	})
})
