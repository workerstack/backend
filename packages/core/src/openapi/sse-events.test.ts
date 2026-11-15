/**
 * A declared event stream in the document: each event an OpenAPI 3.2 `itemSchema` member named by its `event`
 * const, its data a string schema as is or JSON text with its `contentSchema`; and the event declarations the
 * generation paths refuse.
 */
import { describe, expect, it } from "vitest"
import * as z from "zod"
import { httpApp } from "../routing/app.ts"
import { generateOpenApi } from "./generate.ts"

const INFO = { title: "T", version: "1" }

/** The `text/event-stream` media object `GET /events` documents when it declares `ok`. */
function documented(ok: unknown): unknown {
	const app = httpApp<{}>()
	app
		.get("/events")
		.meta({ operationId: "events.list" })
		.output({ "text/event-stream": { ok } } as { "text/event-stream": { ok: true } })
		.handler((ctx) => ctx.res.sse(async () => {}))
	const doc = generateOpenApi(app, { info: INFO })
	const responses = doc.paths["/events"]?.get?.responses as Record<string, { content?: Record<string, unknown> }>
	return responses["200"]?.content?.["text/event-stream"]
}

/** The member an event named `event` with `data` is. */
const member = (event: string, data: unknown) => ({
	properties: { data, event: { const: event } },
	required: ["event", "data"],
	type: "object",
})

const JSON_TEXT = { contentMediaType: "application/json", type: "string" }

describe("a declared event stream documents its events as itemSchema", () => {
	it("a map of events: one member each, in declaration order, object data as JSON text with its schema", () => {
		const media = documented({ data: z.object({ n: z.number() }), heartbeat: z.string() })
		const data = {
			...JSON_TEXT,
			contentSchema: {
				additionalProperties: false,
				properties: { n: { type: "number" } },
				required: ["n"],
				type: "object",
			},
		}
		expect(media).toEqual({ itemSchema: { oneOf: [member("data", data), member("heartbeat", { type: "string" })] } })
	})

	it("a bare schema is the one message event, with no oneOf", () => {
		expect(documented(z.string())).toEqual({ itemSchema: member("message", { type: "string" }) })
		expect(documented(z.number())).toEqual({
			itemSchema: member("message", { ...JSON_TEXT, contentSchema: { type: "number" } }),
		})
	})

	it("ok: true documents the stream with no events", () => {
		expect(documented(true)).toEqual({})
	})
})

describe("the event declarations generation refuses", () => {
	const refusing = (output: object) => () => {
		const app = httpApp<{}>()
		app
			.get("/x")
			.meta({ operationId: "x.get" })
			.output(output as { no_content: true })
			.handler((ctx) => ctx.res.noContent())
		return generateOpenApi(app, { info: INFO })
	}

	it("an event map under any other media type, an empty map, and a name holding a newline", () => {
		expect(refusing({ "application/json": { ok: { tick: z.string() } } })).toThrow(
			"GET /x: .output() event map under application/json: events are declared under text/event-stream only",
		)
		expect(refusing({ "text/event-stream": { ok: {} } })).toThrow(
			"GET /x: .output() text/event-stream ok declares no event",
		)
		expect(refusing({ "text/event-stream": { ok: { "a\nb": z.string() } } })).toThrow(
			'GET /x: .output() event name "a\\nb" holds a newline',
		)
	})
})
