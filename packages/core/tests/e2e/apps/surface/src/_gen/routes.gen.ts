import type { RouteTree, TreeNode } from "@workerstack/backend/http/tree"

function S<T>(o: Record<string, T>): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, o)
}
function N(s: Record<string, TreeNode> = S({}), m: Record<string, string> | null = null, d: TreeNode["d"] = null, w: TreeNode["w"] = null, ws: string | null = null): TreeNode {
	return { d, m, s, w, ws }
}

const T0 = "validation_error"
const T1 = "unauthorized"
const T2 = "bad_request"
const P0 = "POST /in/json"
const P1 = "POST /in/form"
const P2 = "GET /in/search"
const P3 = "GET /in/headers"
const P4 = "GET /in/cookies"
const P5 = "GET /in/params/:orgId/members/:memberId"
const P6 = "GET /in/none"
const P7 = "POST /in/file"
const P8 = "PUT /in/all/:resourceId"
const P9 = "GET /out/text"
const P10 = "GET /out/html"
const P11 = "GET /out/csv"
const P12 = "GET /out/xml"
const P13 = "GET /out/binary"
const P14 = "GET /out/sse"
const T3 = "conflict"
const P15 = "POST /out/multi-status"
const T4 = "not_found"
const P16 = "DELETE /out/no-content/:id"
const P17 = "GET /methods/resource"
const P18 = "POST /methods/resource"
const P19 = "PUT /methods/resource/:id"
const P20 = "PATCH /methods/resource/:id"
const P21 = "DELETE /methods/resource/:id"
const P22 = "GET /status/ok"
const P23 = "POST /status/created"
const P24 = "POST /status/accepted"
const P25 = "DELETE /status/no-content"
const P26 = "GET /stream/filtered"
const P27 = "POST /rs/upload"
const T5 = "websocket"
const P28 = "WS /ws/echo"
const P29 = "WS /ws/room"
const P30 = "WS /ws/reconnect"
const P31 = "WS /ws/chat/:channelId"
const A0 = [T1,T0]
const J0 = {"unauthorized":T1,"validation_error":T2}
const A1 = ["input"]
const M3 = {"operationId":"in.headers.list"} as unknown as MetaShape
const M4 = {"operationId":"in.cookies.list"} as unknown as MetaShape
const M5 = {"operationId":"in.params.members.retrieve"} as unknown as MetaShape
const M7 = {"operationId":"in.file.create"} as unknown as MetaShape
const M8 = {"operationId":"in.all.replace"} as unknown as MetaShape
const M9 = {"operationId":"out.text.list"} as unknown as MetaShape
const M10 = {"operationId":"out.html.list"} as unknown as MetaShape
const M11 = {"operationId":"out.csv.list"} as unknown as MetaShape
const M12 = {"operationId":"out.xml.list"} as unknown as MetaShape
const M13 = {"operationId":"out.binary.list"} as unknown as MetaShape
const M14 = {"operationId":"out.sse.list"} as unknown as MetaShape
const M15 = {"operationId":"out.multiStatus.create"} as unknown as MetaShape
const M16 = {"operationId":"out.noContent.delete"} as unknown as MetaShape
const A2 = ["methods"]
const M22 = {"operationId":"status.ok.list"} as unknown as MetaShape
const M23 = {"operationId":"status.created.create"} as unknown as MetaShape
const M24 = {"operationId":"status.accepted.create"} as unknown as MetaShape
const M25 = {"operationId":"status.noContent.delete"} as unknown as MetaShape
const M26 = {"operationId":"stream.filtered.list"} as unknown as MetaShape
const M27 = {"operationId":"rs.upload.create"} as unknown as MetaShape
const A3 = [T5]
const M0 = {"operationId":"input.createJson","tags":A1} as unknown as MetaShape
const M1 = {"operationId":"input.createForm","tags":A1} as unknown as MetaShape
const M2 = {"auth":"required","operationId":"input.search","tags":A1} as unknown as MetaShape
const M6 = {"operationId":"input.none","tags":A1} as unknown as MetaShape
const M17 = {"operationId":"resources.list","tags":A2} as unknown as MetaShape
const M18 = {"operationId":"resources.create","tags":A2} as unknown as MetaShape
const M19 = {"operationId":"resources.update","tags":A2} as unknown as MetaShape
const M20 = {"operationId":"resources.patch","tags":A2} as unknown as MetaShape
const M21 = {"operationId":"resources.delete","tags":A2} as unknown as MetaShape
const M28 = {"operationId":"ws.echo","tags":A3} as unknown as MetaShape
const M29 = {"operationId":"ws.joinRoom","tags":A3} as unknown as MetaShape
const M30 = {"operationId":"ws.reconnect","tags":A3} as unknown as MetaShape
const M31 = {"operationId":"ws.chat","tags":A3} as unknown as MetaShape

export const tree: TreeNode = N(S({ "in": N(S({ "json": N(undefined, S({ POST: P0 })), "form": N(undefined, S({ POST: P1 })), "search": N(undefined, S({ GET: P2 })), "headers": N(undefined, S({ GET: P3 })), "cookies": N(undefined, S({ GET: P4 })), "params": N(undefined, null, { n: "orgId", c: N(S({ "members": N(undefined, null, { n: "memberId", c: N(undefined, S({ GET: P5 })) }) })) }), "none": N(undefined, S({ GET: P6 })), "file": N(undefined, S({ POST: P7 })), "all": N(undefined, null, { n: "resourceId", c: N(undefined, S({ PUT: P8 })) }) })), "out": N(S({ "text": N(undefined, S({ GET: P9 })), "html": N(undefined, S({ GET: P10 })), "csv": N(undefined, S({ GET: P11 })), "xml": N(undefined, S({ GET: P12 })), "binary": N(undefined, S({ GET: P13 })), "sse": N(undefined, S({ GET: P14 })), "multi-status": N(undefined, S({ POST: P15 })), "no-content": N(undefined, null, { n: "id", c: N(undefined, S({ DELETE: P16 })) }) })), "methods": N(S({ "resource": N(undefined, S({ GET: P17, POST: P18 }), { n: "id", c: N(undefined, S({ PUT: P19, PATCH: P20, DELETE: P21 })) }) })), "status": N(S({ "ok": N(undefined, S({ GET: P22 })), "created": N(undefined, S({ POST: P23 })), "accepted": N(undefined, S({ POST: P24 })), "no-content": N(undefined, S({ DELETE: P25 })) })), "stream": N(S({ "filtered": N(undefined, S({ GET: P26 })) })), "rs": N(S({ "upload": N(undefined, S({ POST: P27 })) })), "ws": N(S({ "echo": N(undefined, null, null, null, P28), "room": N(undefined, null, null, null, P29), "reconnect": N(undefined, null, null, null, P30), "chat": N(undefined, null, { n: "channelId", c: N(undefined, null, null, null, P31) }) })) }))

export const routes: RouteTree["routes"] = S<RouteTree["routes"][string]>({
	[P0]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M0 },
	[P1]: { bd: "form", bek: T0, ek: A0, es: J0, mt: M1 },
	[P2]: { bek: T0, ek: A0, es: J0, mt: M2 },
	[P3]: { bek: T0, ek: A0, es: J0, mt: M3 },
	[P4]: { bek: T0, ek: A0, es: J0, mt: M4 },
	[P5]: { bek: T0, ek: A0, es: J0, mt: M5 },
	[P6]: { bek: T0, ek: A0, es: J0, mt: M6 },
	[P7]: { bd: "form", bek: T0, ek: A0, es: J0, mt: M7 },
	[P8]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M8 },
	[P9]: { bek: T0, ek: A0, es: J0, mt: M9 },
	[P10]: { bek: T0, ek: A0, es: J0, mt: M10 },
	[P11]: { bek: T0, ek: A0, es: J0, mt: M11 },
	[P12]: { bek: T0, ek: A0, es: J0, mt: M12 },
	[P13]: { bek: T0, ek: A0, es: J0, mt: M13 },
	[P14]: { bek: T0, ek: A0, es: J0, mt: M14 },
	[P15]: { bd: "json", bek: T0, ek: [T3,T1,T0], es: {"conflict":T3,"unauthorized":T1,"validation_error":T2}, mt: M15 },
	[P16]: { bek: T0, ek: [T4,T1,T0], es: {"not_found":T4,"unauthorized":T1,"validation_error":T2}, mt: M16 },
	[P17]: { bek: T0, ek: A0, es: J0, mt: M17 },
	[P18]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M18 },
	[P19]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M19 },
	[P20]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M20 },
	[P21]: { bek: T0, ek: A0, es: J0, mt: M21 },
	[P22]: { bek: T0, ek: A0, es: J0, mt: M22 },
	[P23]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M23 },
	[P24]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M24 },
	[P25]: { bek: T0, ek: A0, es: J0, mt: M25 },
	[P26]: { bek: T0, ek: A0, es: J0, mt: M26 },
	[P27]: { bd: "json", bek: T0, ek: A0, es: J0, mt: M27 },
	[P28]: { bek: T0, ek: A0, es: J0, mt: M28 },
	[P29]: { bek: T0, ek: A0, es: J0, mt: M29 },
	[P30]: { bek: T0, ek: A0, es: J0, mt: M30 },
	[P31]: { bek: T0, ek: A0, es: J0, mt: M31 }
})

export type MetaShape = {
	auth?: "required"
	operationId: "input.createJson" | "input.createForm" | "input.search" | "in.headers.list" | "in.cookies.list" | "in.params.members.retrieve" | "input.none" | "in.file.create" | "in.all.replace" | "out.text.list" | "out.html.list" | "out.csv.list" | "out.xml.list" | "out.binary.list" | "out.sse.list" | "out.multiStatus.create" | "out.noContent.delete" | "resources.list" | "resources.create" | "resources.update" | "resources.patch" | "resources.delete" | "status.ok.list" | "status.created.create" | "status.accepted.create" | "status.noContent.delete" | "stream.filtered.list" | "rs.upload.create" | "ws.echo" | "ws.joinRoom" | "ws.reconnect" | "ws.chat"
	tags?: ["input"] | ["methods"] | ["websocket"]
} & Record<string, unknown>


export type RouteSelector = typeof P21 | typeof P16 | typeof P25 | typeof P4 | typeof P3 | typeof P6 | typeof P5 | typeof P2 | typeof P17 | typeof P13 | typeof P11 | typeof P10 | typeof P14 | typeof P9 | typeof P12 | typeof P22 | typeof P26 | typeof P20 | typeof P7 | typeof P1 | typeof P0 | typeof P18 | typeof P15 | typeof P27 | typeof P24 | typeof P23 | typeof P8 | typeof P19

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
	[P20]: M20,
	[P21]: M21,
	[P22]: M22,
	[P23]: M23,
	[P24]: M24,
	[P25]: M25,
	[P26]: M26,
	[P27]: M27,
	[P28]: M28,
	[P29]: M29,
	[P30]: M30,
	[P31]: M31
})

export const routeTree: RouteTree = { v: 2, root: tree, routes, meta }
