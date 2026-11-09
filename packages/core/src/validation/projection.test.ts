/**
 * Which issue of a projected answer the projection explains: an absent key its selection left out, at a row of the
 * projection, and nothing else.
 */
import { describe, expect, it } from "vitest"
import type { Projection, Selection } from "../routing/output-types.ts"
import { projected } from "./projection.ts"

const pick = (scalars: string[], relations: Record<string, Selection | null> = {}): Selection => ({
	relations,
	scalars,
})
const issue = (...path: PropertyKey[]) => ({ message: "invalid", path })

describe("projected: a list's rows under `at`", () => {
	const projection: Projection = { at: "organizations", select: pick(["id"]) }
	const data = { next_cursor: null, organizations: [{ id: "org_1" }, { id: 2 }] }

	it("accepts an absent key the selection left out", () => {
		expect(projected(issue("organizations", 0, "name"), data, projection)).toBe(true)
	})

	it("refuses a present key of the wrong type, selected or not", () => {
		expect(projected(issue("organizations", 1, "id"), data, projection)).toBe(false)
		const extra = { organizations: [{ id: "org_1", slug: 3 }] }
		expect(projected(issue("organizations", 0, "slug"), extra, projection)).toBe(false)
	})

	it("refuses an absent key the selection named", () => {
		const lacking = { organizations: [{}] }
		expect(projected(issue("organizations", 0, "id"), lacking, projection)).toBe(false)
	})

	it("refuses an absent envelope key: only the rows are projected", () => {
		expect(projected(issue("total"), data, projection)).toBe(false)
		expect(projected(issue("organizations"), {}, projection)).toBe(false)
	})

	it("refuses an issue on the row itself or the array, as an object-level refinement reports", () => {
		expect(projected(issue("organizations", 0), data, projection)).toBe(false)
		expect(projected(issue("organizations"), data, projection)).toBe(false)
		expect(projected(issue(), data, projection)).toBe(false)
		expect(projected({ message: "no path" }, data, projection)).toBe(false)
	})

	it("refuses a path through a key that is not an array of rows", () => {
		expect(projected(issue("organizations", "x", "name"), data, projection)).toBe(false)
		expect(projected(issue("organizations", 0, "name"), { organizations: "x" }, projection)).toBe(false)
		expect(projected(issue("organizations", 0, "name"), null, projection)).toBe(false)
		expect(projected(issue("organizations", 5, "name"), data, projection)).toBe(false)
	})

	it("reads Standard Schema's path segment objects as their keys", () => {
		expect(
			projected({ message: "m", path: [{ key: "organizations" }, { key: 0 }, { key: "name" }] }, data, projection),
		).toBe(true)
	})
})

describe("projected: the body as the one row", () => {
	it("accepts an absent unselected key at the root, and refuses one under `*`", () => {
		expect(projected(issue("name"), { id: "a" }, { select: pick(["id"]) })).toBe(true)
		expect(projected(issue("name"), { id: "a" }, { select: pick(["*"]) })).toBe(false)
	})

	it("refuses when the body is no object", () => {
		expect(projected(issue("name"), null, { select: pick(["id"]) })).toBe(false)
		expect(projected(issue("name"), [], { select: pick(["id"]) })).toBe(false)
	})

	it("counts `@x`, a computed field, as selecting both `@x` and `x`", () => {
		const select = pick(["@score"])
		expect(projected(issue("score"), {}, { select })).toBe(false)
		expect(projected(issue("@score"), {}, { select })).toBe(false)
	})
})

describe("projected: embedded relations", () => {
	const select = pick(["id"], { author: pick(["name"]), tags: pick(["label"]), owner: null })
	const projection: Projection = { at: "posts", select }
	const data = {
		posts: [{ author: { name: "Ann" }, id: "p1", owner: { id: "u1" }, tags: [{ label: "a" }, { label: "b" }] }],
	}

	it("accepts an absent unselected key of an embedded object and of each item of an embedded array", () => {
		expect(projected(issue("posts", 0, "author", "email"), data, projection)).toBe(true)
		expect(projected(issue("posts", 0, "tags", 1, "color"), data, projection)).toBe(true)
	})

	it("accepts an absent relation the selection did not embed", () => {
		const select2 = pick(["id"])
		expect(projected(issue("posts", 0, "author"), { posts: [{ id: "p1" }] }, { at: "posts", select: select2 })).toBe(
			true,
		)
	})

	it("refuses an absent relation the selection embedded, and any key of a whole (`null`) relation", () => {
		expect(projected(issue("posts", 0, "author"), { posts: [{ id: "p1" }] }, projection)).toBe(false)
		expect(projected(issue("posts", 0, "owner", "email"), data, projection)).toBe(false)
	})

	it("refuses a path into a relation that is no object, or into a scalar", () => {
		const odd = { posts: [{ author: "Ann", id: "p1", tags: [{ label: "a" }] }] }
		expect(projected(issue("posts", 0, "author", "email"), odd, projection)).toBe(false)
		expect(projected(issue("posts", 0, "id", "x"), data, projection)).toBe(false)
		expect(projected(issue("posts", 0, "tags", "x", "color"), data, projection)).toBe(false)
	})
})
