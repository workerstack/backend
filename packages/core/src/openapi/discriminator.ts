/**
 * OpenAPI's `discriminator` for a tagged union (D9): a `oneOf` or `anyOf` whose members are all objects that require
 * one property holding a `const`, each member's const its own. An SDK reads the property to tell members apart.
 */
import type { JsonSchema } from "../schema/to-json-schema.ts"

type Properties = Readonly<Record<string, JsonSchema | undefined>>

/** The const `member` requires under `key`, else `undefined`. */
function constOf(member: unknown, key: string): unknown {
	if (!(member instanceof Object)) return undefined
	const { properties, required } = member as JsonSchema
	if (!Array.isArray(required) || !required.includes(key)) return undefined
	return (properties as Properties | undefined)?.[key]?.const
}

/** The property every member of `members` requires with a const of its own, the first in the first member's order. */
function tagOf(members: readonly unknown[]): string | null {
	const first = members[0] as JsonSchema | undefined
	for (const key of Object.keys((first?.properties as Properties | undefined) ?? {})) {
		const tags = members.map((member) => constOf(member, key))
		if (tags.every((tag) => tag !== undefined) && new Set(tags.map((tag) => JSON.stringify(tag))).size === tags.length)
			return key
	}
	return null
}

/** `schema` with its `discriminator` when it is a tagged union, else `schema` as it is. */
export function withDiscriminator(schema: JsonSchema): JsonSchema {
	const members = schema.oneOf ?? schema.anyOf
	if (!Array.isArray(members) || members.length < 2) return schema
	const propertyName = tagOf(members)
	return propertyName === null ? schema : { ...schema, discriminator: { propertyName } }
}
