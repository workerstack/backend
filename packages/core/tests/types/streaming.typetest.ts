/**
 * The streaming helpers as typed: sse(), stream() and generate() brand their responses with a
 * content type and the ok status, the SSE stream and event shapes, and a route answering with
 * each, and the declared events typing `send` under `.output()`. Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { HttpRes, type TypedResponse } from "../../src/response/response.ts"
import type { SSEEvent, SSEStream } from "../../src/response/sse.ts"
import type { HttpContext } from "../../src/context/context.ts"
import type { WithOutput } from "../../src/routing/codegen-types.ts"
import { httpApp } from "../../src/routing/app.ts"

const res = new HttpRes()

describe("the streaming helpers brand what they return", () => {
	// v0: 63c73d341e
	it("sse() is text/event-stream, ok", () => {
		expectTypeOf(res.sse(async () => {})).toEqualTypeOf<TypedResponse<"text/event-stream", "ok">>()
	})

	// v0: 8ed2c84e5e
	it("stream() is application/octet-stream, ok", () => {
		expectTypeOf(res.stream(async () => {})).toEqualTypeOf<TypedResponse<"application/octet-stream", "ok">>()
	})

	// v0: 52feb8c24d
	it("generate() is ok, its content type whatever it was given", () => {
		expectTypeOf(res.generate((function* () {})())).toEqualTypeOf<TypedResponse<string, "ok">>()
	})
})

describe("the SSE stream and its events", () => {
	it("send() takes an event and resolves when the client wants more", () => {
		expectTypeOf<SSEStream["send"]>().toEqualTypeOf<(event: SSEEvent) => Promise<void>>()
		expectTypeOf<SSEStream["lastEventId"]>().toEqualTypeOf<string | undefined>()
		expectTypeOf<SSEStream["signal"]>().toEqualTypeOf<AbortSignal>()
		expectTypeOf<SSEStream["closed"]>().toEqualTypeOf<boolean>()
	})

	it("an event needs data; its name (message when left out), id and retry are optional", () => {
		expectTypeOf<{ data: string; event: string }>().toExtend<SSEEvent>()
		expectTypeOf<{ data: { n: number }; event: string; id: string; retry: number }>().toExtend<SSEEvent>()
		expectTypeOf<{ data: string }>().toExtend<SSEEvent>()
		expectTypeOf<{ event: string }>().not.toExtend<SSEEvent>()
		expectTypeOf<{ data: number; event: string }>().not.toExtend<SSEEvent>()
	})

	it("a stream() callback gets the writable and the request's signal", () => {
		res.stream(async (writable, signal) => {
			expectTypeOf(writable).toEqualTypeOf<WritableStream>()
			expectTypeOf(signal).toEqualTypeOf<AbortSignal>()
		})
	})
})

describe("routes answer with a stream", () => {
	it("a handler may return sse(), stream() or generate()", () => {
		const app = httpApp<{}>()
		app.get("/events").handler((ctx) => ctx.res.sse(async (stream) => stream.send({ data: "x", event: "m" })))
		app.get("/download").handler((ctx) => ctx.res.stream(async () => {}))
		app.get("/lines").handler((ctx) => ctx.res.generate((function* () {})(), { contentType: "application/x-ndjson" }))
		expectTypeOf(app.fetch).returns.toEqualTypeOf<Response | Promise<Response>>()
	})
})

describe("the declared events type send under .output()", () => {
	it("a map of events takes each declared name with its schema's data", () => {
		httpApp<{}>()
			.get("/events")
			.output({ "text/event-stream": { ok: { data: z.object({ n: z.number() }), heartbeat: z.string() } } })
			.handler((ctx) =>
				ctx.res.sse(async (stream) => {
					expectTypeOf<Parameters<typeof stream.send>[0]["event"]>().toEqualTypeOf<"data" | "heartbeat">()
					await stream.send({ data: "tick", event: "heartbeat", id: "1" })
					await stream.send({ data: { n: 42 }, event: "data", retry: 1000 })
					// @ts-expect-error "nope" is no declared event
					await stream.send({ data: "x", event: "nope" })
					// @ts-expect-error data's schema takes an object, not a string
					await stream.send({ data: "x", event: "data" })
					// @ts-expect-error a map names every event: none is message
					await stream.send({ data: "x" })
				}),
			)
	})

	it("a bare schema is the message event: the name may be left out", () => {
		httpApp<{}>()
			.get("/events")
			.output({ "text/event-stream": { ok: z.string() } })
			.handler((ctx) =>
				ctx.res.sse(async (stream) => {
					expectTypeOf<Parameters<typeof stream.send>[0]["event"]>().toEqualTypeOf<"message" | undefined>()
					await stream.send({ data: "hi" })
					await stream.send({ data: "hi", event: "message", id: "2" })
					// @ts-expect-error a bare schema declares only message
					await stream.send({ data: "hi", event: "tick" })
					// @ts-expect-error the schema takes a string
					await stream.send({ data: 5 })
				}),
			)
	})

	it("ok: true, and a declaration that holds no schema, keep the untyped stream", () => {
		httpApp<{}>()
			.get("/events")
			.output({ "text/event-stream": { ok: true } })
			.handler((ctx) =>
				ctx.res.sse(async (stream) => {
					expectTypeOf(stream.send).toEqualTypeOf<(event: SSEEvent) => Promise<void>>()
				}),
			)
		type Generated = WithOutput<HttpContext<{}>, { "text/event-stream": { ok: string } }>
		type Callback = Extract<Parameters<Generated["res"]["sse"]>[0], (stream: never) => unknown>
		expectTypeOf<Parameters<Callback>[0]>().toEqualTypeOf<SSEStream>()
	})
})
