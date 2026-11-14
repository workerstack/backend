import { describe, expect, it } from "vitest"
import { rawBodyOf, replaceResponse, withRawBody } from "./builder.ts"

function streamOf(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(c) {
			c.enqueue(new TextEncoder().encode(text))
			c.close()
		},
	})
}

describe("replaceResponse", () => {
	// v0: c551b10135
	it("keeps headers and statusText when only the status changes on a native response", () => {
		const native = new Response("x", { headers: { "x-keep": "1" }, status: 200, statusText: "Fine" })
		const same = replaceResponse(native, { body: "y" })
		expect(same.headers.get("x-keep")).toBe("1")
		expect(same.statusText).toBe("Fine")
		const moved = replaceResponse(new Response("x", { headers: { "x-keep": "1" } }), { status: 201 })
		expect(moved.status).toBe(201)
		expect(moved.headers.get("x-keep")).toBe("1")
	})

	// v0: 941994b43f
	it("returns a 101 unchanged", () => {
		const upgrade = { headers: new Headers(), status: 101 } as unknown as Response
		expect(replaceResponse(upgrade, { headers: { "x-a": "1" } })).toBe(upgrade)
	})

	it("answers every body kind with the new status, the carried headers and the new body", async () => {
		const res = new Response("x", { headers: { "x-a": "1" } })
		const cases: [BodyInit | null | undefined, string][] = [
			[undefined, "x"],
			["text", "text"],
			[new Uint8Array([98]), "b"],
			[new Uint8Array([99]).buffer, "c"],
			[streamOf("s"), "s"],
			[null, ""],
		]
		for (const [body, text] of cases) {
			const next = replaceResponse(new Response(res.clone().body, res), { body, status: 202 })
			expect([next.status, next.headers.get("x-a"), await next.text()]).toEqual([202, "1", text])
		}
	})

	it("new headers replace the response's, given as Headers or as a record", () => {
		expect(replaceResponse(new Response("x"), { headers: new Headers({ "x-h": "1" }) }).headers.get("x-h")).toBe("1")
		expect(replaceResponse(new Response("x"), { headers: { "x-r": "1" } }).headers.get("x-r")).toBe("1")
	})
})

describe("the raw-body side table", () => {
	it("rawBodyOf reads what withRawBody recorded, defines no property on the response, and is null for a foreign one", () => {
		const native = withRawBody(new Response("x"), "x")
		expect(rawBodyOf(native)).toBe("x")
		expect(Object.getOwnPropertySymbols(native)).toEqual([])
		expect(rawBodyOf(new Response("z"))).toBeNull()
	})
})
