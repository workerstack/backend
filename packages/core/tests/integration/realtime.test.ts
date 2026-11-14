/**
 * Resume through the reference server (H8) driven through `app.fetch`, on the public hook SSE
 * `Last-Event-ID` alone.
 */
import { describe, expect, it } from "vitest"
import { createReferenceServer } from "./conformance/reference-server.ts"

/** The reference server with `count` events already logged. */
function reference(count: number) {
	const ref = createReferenceServer()
	for (let n = 1; n <= count; n++) ref.append({ n })
	return {
		...ref,
		request: (init?: RequestInit) => ref.app.fetch(new Request("http://localhost/events", init), {}),
	}
}

/** The first `count` SSE events a client receives as `[id, data]`; the client then leaves. */
async function sseEvents(
	ref: ReturnType<typeof reference>,
	count: number,
	headers: Record<string, string> = {},
	onOpen?: () => void,
) {
	const abort = new AbortController()
	const res = await ref.request({ headers, signal: abort.signal })
	onOpen?.()
	const reader = (res.body as ReadableStream<Uint8Array>).getReader()
	const decoder = new TextDecoder()
	const events: [string, unknown][] = []
	let text = ""
	while (events.length < count) {
		const { value } = await reader.read()
		text += decoder.decode(value, { stream: true })
		const blocks = text.split("\n\n")
		text = blocks.pop() as string
		for (const block of blocks) {
			const fields = Object.fromEntries(block.split("\n").map((line) => line.split(": ", 2) as [string, string]))
			if (fields.id !== undefined) events.push([fields.id, JSON.parse(fields.data as string)])
		}
	}
	abort.abort()
	return [res.headers.get("content-type"), events.slice(0, count)] as const
}

describe("the reference server: SSE resume through Last-Event-ID", () => {
	it("posts append to the log; a fresh stream gets it all, then live events", async () => {
		const ref = reference(0)
		const posted = await ref.request({ body: JSON.stringify({ n: 1 }), method: "POST" })
		const stream = await sseEvents(ref, 2, {}, () => setTimeout(() => ref.append({ n: 2 }), 20))
		expect([await posted.json(), stream]).toEqual([
			{ data: { n: 1 }, id: 1 },
			[
				"text/event-stream",
				[
					["1", { n: 1 }],
					["2", { n: 2 }],
				],
			],
		])
	})

	it("Last-Event-ID resumes after that id", async () => {
		const [, events] = await sseEvents(reference(3), 2, { "last-event-id": "1" })
		expect(events).toEqual([
			["2", { n: 2 }],
			["3", { n: 3 }],
		])
	})
})
