import type { RouteTree, TreeNode } from "@workerstack/backend/http/tree"

function S<T>(o: Record<string, T>): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, o)
}
function N(s: Record<string, TreeNode> = S({}), m: Record<string, string> | null = null, d: TreeNode["d"] = null, w: TreeNode["w"] = null, ws: string | null = null): TreeNode {
	return { d, m, s, w, ws }
}

const T0 = "api_error"
const T1 = "invalid_input"
const T2 = "unauthorized"
const T3 = "internal_server_error"
const T4 = "bad_request"
const P0 = "GET /api"
const T5 = "greeting_refused"
const T6 = "forbidden"
const T7 = "hello.list"
const P1 = "GET /api/hello"
const P2 = "POST /api/hello"
const P3 = "GET /api/health"
const P4 = "GET /api/events"
const P5 = "GET /api/events-live"
const P6 = "ALL /api/echo"
const P7 = "GET /api/v1/organizations"
const T8 = "org_limit_reached"
const P8 = "POST /api/v1/organizations"
const P9 = "GET /api/v1/organizations/:orgId"
const P10 = "DELETE /api/v1/organizations/:orgId"
const P11 = "WS /api/echo-ws"
const P12 = "WS /api/v1/socket"
const P13 = "WS /api/reconnect-ws"
const P14 = "WS /api/realtime/echo"
const P15 = "WS /api/realtime/chat/:roomId"
const P16 = "POST /api/realtime/broadcast/:topic"
const P17 = "GET /api/served-from"
const P18 = "GET /api/webhook-sample"
const P19 = "GET /api/boundary/default"
const P20 = "GET /api/boundary/custom"
const A0 = [T5]
const J0 = {"greeting_refused":T6}
const M1 = {"operationId":T7} as unknown as MetaShape
const A1 = [T0,T2]
const J1 = {"api_error":T3,"unauthorized":T2}
const M3 = {"operationId":"health.check"} as unknown as MetaShape
const M4 = {"operationId":"events.list"} as unknown as MetaShape
const M5 = {"operationId":"eventsLive.list"} as unknown as MetaShape
const M6 = {"operationId":"echo"} as unknown as MetaShape
const M7 = {"operationId":"organizations.list"} as unknown as MetaShape
const M8 = {"operationId":"organizations.create"} as unknown as MetaShape
const M9 = {"operationId":"organizations.retrieve"} as unknown as MetaShape
const M10 = {"operationId":"organizations.delete"} as unknown as MetaShape
const M11 = {"operationId":"echoWs.connect"} as unknown as MetaShape
const M12 = {"operationId":"v1.socket.connect"} as unknown as MetaShape
const M13 = {"operationId":"reconnectWs.connect"} as unknown as MetaShape
const M14 = {"operationId":"realtime.echo.connect"} as unknown as MetaShape
const M15 = {"operationId":"realtime.chat.connect"} as unknown as MetaShape
const M16 = {"operationId":"realtime.broadcast.create"} as unknown as MetaShape
const M17 = {"operationId":"servedFrom.list","internal":true} as unknown as MetaShape
const M18 = {"operationId":"webhookSample.list","internal":true} as unknown as MetaShape
const M19 = {"operationId":"boundary.default.list"} as unknown as MetaShape
const M20 = {"operationId":"boundary.custom.list"} as unknown as MetaShape
const M0 = {"operationId":"root.list","description":"Test route","summary":"Root test route","tags":["test"]} as unknown as MetaShape
const M2 = {"invalidate":[T7],"operationId":"hello.create"} as unknown as MetaShape

export const tree: TreeNode = N(S({ "api": N(S({ "hello": N(undefined, S({ GET: P1, POST: P2 })), "health": N(undefined, S({ GET: P3 })), "events": N(undefined, S({ GET: P4 })), "events-live": N(undefined, S({ GET: P5 })), "echo": N(undefined, S({ ALL: P6 })), "v1": N(S({ "organizations": N(undefined, S({ GET: P7, POST: P8 }), { n: "orgId", c: N(undefined, S({ GET: P9, DELETE: P10 })) }), "socket": N(undefined, null, null, null, P12) })), "echo-ws": N(undefined, null, null, null, P11), "reconnect-ws": N(undefined, null, null, null, P13), "realtime": N(S({ "echo": N(undefined, null, null, null, P14), "chat": N(undefined, null, { n: "roomId", c: N(undefined, null, null, null, P15) }), "broadcast": N(undefined, null, { n: "topic", c: N(undefined, S({ POST: P16 })) }) })), "served-from": N(undefined, S({ GET: P17 })), "webhook-sample": N(undefined, S({ GET: P18 })), "boundary": N(S({ "default": N(undefined, S({ GET: P19 })), "custom": N(undefined, S({ GET: P20 })) })) }), S({ GET: P0 })) }))

export const routes: RouteTree["routes"] = S<RouteTree["routes"][string]>({
	[P0]: { bek: T0, ek: [T0,T1,T2], es: {"api_error":T3,"invalid_input":T4,"unauthorized":T2}, mt: M0 },
	[P1]: { ek: A0, es: J0, mt: M1 },
	[P2]: { bd: "json", ek: A0, es: J0, mt: M2 },
	[P3]: { bek: T0, ek: A1, es: J1, mt: M3 },
	[P4]: { bek: T0, ek: A1, es: J1, mt: M4 },
	[P5]: { bek: T0, ek: A1, es: J1, mt: M5 },
	[P6]: { bek: T0, ek: A1, es: J1, mt: M6 },
	[P7]: { bek: T0, ek: A1, es: J1, mt: M7 },
	[P8]: { bek: T0, ek: [T0,T1,T8,"org_slug_taken",T2], es: {"api_error":T3,"invalid_input":T4,"org_limit_reached":T6,"org_slug_taken":"conflict","unauthorized":T2}, mt: M8 },
	[P9]: { bek: T0, ek: A1, es: J1, mt: M9 },
	[P10]: { bek: T0, ek: A1, es: J1, mt: M10 },
	[P11]: { bek: T0, ek: A1, es: J1, mt: M11 },
	[P12]: { bek: T0, ek: A1, es: J1, mt: M12 },
	[P13]: { bek: T0, ek: A1, es: J1, mt: M13 },
	[P14]: { bek: T0, ek: A1, es: J1, mt: M14 },
	[P15]: { bek: T0, ek: A1, es: J1, mt: M15 },
	[P16]: { bek: T0, ek: A1, es: J1, mt: M16 },
	[P17]: { bek: T0, ek: A1, es: J1, mt: M17 },
	[P18]: { bek: T0, ek: A1, es: J1, mt: M18 },
	[P19]: { bek: T0, ek: A1, es: J1, mt: M19 },
	[P20]: { bek: T8, ek: [T0,T8,T2], es: {"api_error":T3,"org_limit_reached":T6,"unauthorized":T2}, mt: M20 }
})

export type MetaShape = {
	description?: "Test route"
	internal?: true
	invalidate?: ["hello.list"]
	operationId: "root.list" | "hello.list" | "hello.create" | "health.check" | "events.list" | "eventsLive.list" | "echo" | "organizations.list" | "organizations.create" | "organizations.retrieve" | "organizations.delete" | "echoWs.connect" | "v1.socket.connect" | "reconnectWs.connect" | "realtime.echo.connect" | "realtime.chat.connect" | "realtime.broadcast.create" | "servedFrom.list" | "webhookSample.list" | "boundary.default.list" | "boundary.custom.list"
	summary?: "Root test route"
	tags?: ["test"]
} & Record<string, unknown>

export const meta: Record<string, MetaShape> = S({
	[P0]: M0,
	[P1]: M1,
	[P2]: M2,
	[P3]: M3,
	[P4]: M4,
	[P5]: M5,
	[P6]: M6,
	[P7]: M7,
	[P8]: M8,
	[P9]: M9,
	[P10]: M10,
	[P11]: M11,
	[P12]: M12,
	[P13]: M13,
	[P14]: M14,
	[P15]: M15,
	[P16]: M16,
	[P17]: M17,
	[P18]: M18,
	[P19]: M19,
	[P20]: M20
})

export const routeTree: RouteTree = { v: 2, root: tree, routes, meta }
