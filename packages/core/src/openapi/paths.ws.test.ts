import { describe, expect, it } from "vitest"
import * as z from "zod"
import { defineErrors } from "../errors/errors.ts"
import { createMiddleware } from "../middleware/middleware.ts"
import { httpApp } from "../routing/app.ts"
import { SILENT, type BackendLogger } from "../telemetry/logger.ts"
import { generateOpenApi } from "./generate.ts"
import { ws } from "../ws/route.ts"
import { realtime } from "../realtime/realtime.ts"

/** A reference to a named component schema. */
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const INFO = { title: "T", version: "1" }
type Doc = ReturnType<typeof generateOpenApi>
type Param = { in: string; name: string }

const op = (doc: Doc, path: string, method = "get") => (doc.paths[path]?.[method] ?? {}) as Record<string, unknown>
const params = (doc: Doc, path: string, method = "get") => (op(doc, path, method).parameters ?? []) as Param[]
const names = (doc: Doc, path: string, method = "get") => params(doc, path, method).map((p) => p.name)

/** A logger that keeps each warning's message. */
function recording(): { logger: BackendLogger; warnings: string[] } {
	const warnings: string[] = []
	const warn = (first: unknown, second?: unknown) =>
		void warnings.push(String(typeof first === "string" ? first : second))
	return { logger: { ...SILENT, warn }, warnings }
}

describe("WebSocket operations", () => {
	// v0: 4c2b9d2aa5
	// v0: 74e37ef9b9
	// v0: 7629efa019
	// v0: 780b2e4126
	// v0: d537e2ff0d
	// v0: 8b32760001
	it("document a WS route as a GET upgrade: its policy run as ws, its search fields as parameters bar x-internal ones", () => {
		const app = httpApp<{}>().metaType<{ tenant?: string }>()
		app.metaSpec({ meta: { tenant: { key: "x-tenant", on: "http" } } })
		app
			.get("/a")
			.meta({ operationId: "a.list", tenant: "orgId" })
			.handler((c) => c.res.text("ok", "ok"))
		ws(app, "/live")
			.meta({ operationId: "live.connect", tenant: "orgId" } as never)
			.input({ search: z.object({ secret: z.string().meta({ "x-internal": true }), token: z.string() }) })
			.handler({ onMessage() {} })
		ws(app, "/ws/chat/:channelId")
			.meta({ operationId: "ws.chat.connect" })
			.handler({ onMessage() {} })
		const doc = generateOpenApi(app, { info: INFO })
		expect(params(doc, "/ws/chat/{channelId}").map((p) => [p.name, p.in])).toEqual([["channelId", "path"]])
		expect([
			op(doc, "/a")["x-tenant"],
			op(doc, "/live")["x-tenant"],
			op(doc, "/live")["x-websocket"],
			names(doc, "/live"),
			op(doc, "/live").responses,
		]).toEqual(["orgId", undefined, true, ["token"], { "101": { description: "WebSocket upgrade" } }])
	})
})

describe("WebSocket operations, continued (2)", () => {
	it("leaves out a WS route an HTTP GET of the same path shadows, and says so through the logger", () => {
		const app = httpApp<{}>()
		app
			.get("/chat")
			.meta({ operationId: "chat.list" })
			.handler((c) => c.res.text("ok", "ok"))
		ws(app, "/chat").handler({ onMessage() {} })
		const { logger, warnings } = recording()
		const doc = generateOpenApi(app, { info: INFO, logger })
		expect([op(doc, "/chat")["x-websocket"], warnings]).toEqual([
			undefined,
			[expect.stringMatching(/WS_SHADOWED.*WS \/chat/s)],
		])
	})

	// v0: e61795b84c
	it("leaves out a WS route marked internal and one filterRoutes rejects, keeping the rest", () => {
		const app = httpApp<{}>()
		ws(app, "/open")
			.meta({ operationId: "open.connect" })
			.handler({ onMessage() {} })
		ws(app, "/hidden")
			.meta({ internal: true })
			.handler({ onMessage() {} })
		ws(app, "/filtered").handler({ onMessage() {} })
		const doc = generateOpenApi(app, { filterRoutes: (route) => route.path !== "/filtered", info: INFO })
		expect([Object.keys(doc.paths), op(doc, "/open")["x-websocket"]]).toEqual([["/open"], true])
	})
})

describe("a WS route's own keys", () => {
	// v0: 10d1ae37cb
	it("documents a WS route with its own keys alone: never deprecated, security, x-invalidate or x-mcp", () => {
		const app = httpApp<{}>()
		const every = {
			deprecated: true,
			description: "d",
			invalidate: ["users.list"],
			mcp: true,
			operationId: "live",
			security: "jwt",
			summary: "s",
			tags: "sockets",
		}
		ws(app, "/live")
			.meta({ operationId: "live.wsLive" })
			.meta(every as never)
			.handler({ onMessage() {} })
		expect(Object.keys(op(generateOpenApi(app, { info: INFO }), "/live"))).toEqual([
			"x-websocket",
			"summary",
			"description",
			"tags",
			"operationId",
			"x-backend-route",
			"responses",
		])
	})
})

/** Each documented response of the operation at `path`, as its status and description. */
function status(doc: Doc, path: string) {
	const responses = op(doc, path).responses as Record<string, { description: string }>
	return Object.entries(responses).map(([code, { description }]) => [code, description])
}

/** Each key in the operation's `x-backend-errors`, with its status. */
const declared = (doc: Doc, path: string) =>
	Object.entries((op(doc, path)["x-backend-errors"] ?? {}) as Record<string, { status: number }>).map(
		([key, entry]) => [key, entry.status],
	)

describe("a WS route documents its upgrade as an HTTP operation documents its request", () => {
	it("its search, header and cookie inputs as parameters, and each declared error as an answer before the 101", () => {
		const app = httpApp<{}>()
		ws(app, "/room")
			.meta({ operationId: "room.connect" })
			.input({
				cookies: z.object({ session: z.string().optional() }),
				headers: z.object({ "x-room-token": z.string().optional() }),
				search: z.object({ roomId: z.string() }),
			})
			.errors("not_found")
			.handler({ onMessage() {} })
		const doc = generateOpenApi(app, { info: INFO })
		expect([params(doc, "/room").map((p) => [p.name, p.in]), status(doc, "/room"), declared(doc, "/room")]).toEqual([
			[
				["session", "cookie"],
				["x-room-token", "header"],
				["roomId", "query"],
			],
			[
				["101", "WebSocket upgrade"],
				["404", "not_found"],
			],
			[["not_found", 404]],
		])
	})
})

describe("a WS route documents the errors its chain declares", () => {
	it("an error its middleware declares, and only the 101 with no x-backend-errors when nothing is declared", () => {
		const own = defineErrors({ auth_required: "unauthorized" })
		const auth = createMiddleware((_ctx, next) => next(), { errors: [own, "auth_required"] })
		const app = httpApp<{}>().errorFactory(own)
		ws(app.use(auth), "/guarded")
			.meta({ operationId: "guarded.connect" })
			.handler({ onMessage() {} })
		const plain = httpApp<{}>()
		ws(plain, "/open")
			.meta({ operationId: "open.connect" })
			.handler({ onMessage() {} })
		const guarded = generateOpenApi(app, { info: INFO })
		const open = generateOpenApi(plain, { info: INFO })
		expect([
			status(guarded, "/guarded"),
			declared(guarded, "/guarded"),
			status(open, "/open"),
			"x-backend-errors" in op(open, "/open"),
		]).toEqual([
			[
				["101", "WebSocket upgrade"],
				["401", "auth_required"],
			],
			[["auth_required", 401]],
			[["101", "WebSocket upgrade"]],
			false,
		])
	})
})

describe("WebSocket operations: declared messages", () => {
	const TalkIn = z.discriminatedUnion("type", [
		z.object({ text: z.string(), type: z.literal("say") }),
		z.object({ type: z.literal("ping") }),
	])
	const TalkOut = z.union([
		z.object({ text: z.string(), type: z.literal("said") }),
		z.object({ type: z.literal("pong") }),
	])
	it("writes x-websocket's receive and send as refs named from the operationId, a tagged union with its discriminator", () => {
		const app = httpApp<{}>()
		ws(app, "/ws/talk")
			.meta({ operationId: "ws.talk" })
			.messages({ receive: TalkIn, send: TalkOut })
			.handler({ onMessage() {} })
		ws(app, "/ws/echo")
			.meta({ operationId: "ws.echo" })
			.handler({ onMessage() {} })
		const doc = generateOpenApi(app, { info: INFO })
		const schemas = doc.components?.schemas as Record<string, Record<string, unknown>>
		expect([
			op(doc, "/ws/talk")["x-websocket"],
			op(doc, "/ws/echo")["x-websocket"],
			schemas.WsTalkReceive?.discriminator,
			(schemas.WsTalkReceive?.oneOf as unknown[] | undefined)?.length,
			schemas.WsTalkSend?.discriminator,
			(schemas.WsTalkSend?.anyOf as unknown[] | undefined)?.length,
		]).toEqual([
			{ receive: ref("WsTalkReceive"), send: ref("WsTalkSend") },
			true,
			{ propertyName: "type" },
			2,
			{ propertyName: "type" },
			2,
		])
	})
})

describe("WebSocket operations: declared messages, one direction", () => {
	it("writes only the direction a route declares; no discriminator without one const property every member requires", () => {
		const app = httpApp<{}>()
		ws(app, "/in")
			.meta({ operationId: "in.only" })
			.messages({ receive: z.object({ n: z.number() }) })
			.handler({ onMessage() {} })
		ws(app, "/out")
			.meta({ operationId: "out.only" })
			.messages({ send: z.union([z.object({ a: z.literal("x") }), z.object({ b: z.literal("y") })]) })
			.handler({ onMessage() {} })
		ws(app, "/same")
			.meta({ operationId: "same.tag" })
			.messages({ send: z.union([z.object({ t: z.literal("x") }), z.object({ t: z.literal("x"), u: z.number() })]) })
			.handler({ onMessage() {} })
		const doc = generateOpenApi(app, { info: INFO })
		const schemas = doc.components?.schemas as Record<string, Record<string, unknown>>
		expect([
			op(doc, "/in")["x-websocket"],
			op(doc, "/out")["x-websocket"],
			Object.hasOwn(schemas.InOnlyReceive ?? {}, "discriminator"),
			Object.hasOwn(schemas.OutOnlySend ?? {}, "discriminator"),
			Object.hasOwn(schemas.SameTagSend ?? {}, "discriminator"),
			schemas.InOnlyReceive?.type,
		]).toEqual([{ receive: ref("InOnlyReceive") }, { send: ref("OutOnlySend") }, false, false, false, "object"])
	})
})

describe("realtime operations", () => {
	it("mark every realtime route x-realtime, a typed one with its refs; a ws route stays unmarked, and meta cannot unmark one", () => {
		const app = httpApp<{}>()
		realtime(app, "/rt/room", {
			handler: () => {},
			messages: { receive: z.object({ text: z.string() }), send: z.object({ said: z.string() }) },
			meta: { operationId: "rt.room" },
		})
		realtime(app, "/rt/plain", { handler: () => {}, meta: { operationId: "rt.plain" } })
		realtime(app, "/rt/hidden", {
			handler: () => {},
			meta: { extensions: { "x-realtime": false }, operationId: "rt.hidden" },
		})
		ws(app, "/ws/plain")
			.meta({ operationId: "ws.plain" })
			.handler({ onMessage() {} })
		const doc = generateOpenApi(app, { info: INFO })
		const marks = (path: string) => [op(doc, path)["x-websocket"], op(doc, path)["x-realtime"]]
		expect([
			marks("/rt/room"),
			marks("/rt/plain"),
			marks("/rt/hidden"),
			marks("/ws/plain"),
			Object.hasOwn(op(doc, "/ws/plain"), "x-realtime"),
		]).toEqual([
			[{ receive: ref("RtRoomReceive"), send: ref("RtRoomSend") }, true],
			[true, true],
			[true, true],
			[true, undefined],
			false,
		])
	})
})
