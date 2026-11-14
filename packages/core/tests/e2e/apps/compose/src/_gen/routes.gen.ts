import type { RouteTree, TreeNode } from "@workerstack/backend/http/tree"

function S<T>(o: Record<string, T>): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, o)
}
function N(s: Record<string, TreeNode> = S({}), m: Record<string, string> | null = null, d: TreeNode["d"] = null, w: TreeNode["w"] = null, ws: string | null = null): TreeNode {
	return { d, m, s, w, ws }
}

const T0 = "expired_token"
const T1 = "invalid_token"
const T2 = "unauthorized"
const P0 = "GET /health"
const P1 = "GET /docs"
const P2 = "GET /feed"
const T3 = "forbidden"
const P3 = "GET /account"
const P4 = "POST /account/settings"
const T4 = "not_found"
const P5 = "GET /resources/:resourceId"
const P6 = "DELETE /resources/:resourceId"
const P7 = "POST /resources"
const A0 = [T0,T1]
const J0 = {"expired_token":T2,"invalid_token":T2}
const M0 = {"operationId":"health.list"} as unknown as MetaShape
const M1 = {"operationId":"docs.list"} as unknown as MetaShape
const M2 = {"operationId":"feed.list"} as unknown as MetaShape
const A1 = [T0,T3,T1]
const J1 = {"expired_token":T2,"forbidden":T3,"invalid_token":T2}
const M3 = {"operationId":"account.list"} as unknown as MetaShape
const M4 = {"operationId":"account.settings.create"} as unknown as MetaShape
const A2 = [T0,T3,T1,T4]
const J2 = {"expired_token":T2,"forbidden":T3,"invalid_token":T2,"not_found":T4}
const M5 = {"operationId":"resources.retrieve"} as unknown as MetaShape
const M6 = {"operationId":"resources.delete"} as unknown as MetaShape
const M7 = {"operationId":"resources.create"} as unknown as MetaShape

export const tree: TreeNode = N(S({ "health": N(undefined, S({ GET: P0 })), "docs": N(undefined, S({ GET: P1 })), "feed": N(undefined, S({ GET: P2 })), "account": N(S({ "settings": N(undefined, S({ POST: P4 })) }), S({ GET: P3 })), "resources": N(undefined, S({ POST: P7 }), { n: "resourceId", c: N(undefined, S({ GET: P5, DELETE: P6 })) }) }))

export const routes: RouteTree["routes"] = S<RouteTree["routes"][string]>({
	[P0]: { ek: A0, es: J0, mt: M0 },
	[P1]: { ek: A0, es: J0, mt: M1 },
	[P2]: { ek: A0, es: J0, mt: M2 },
	[P3]: { ek: A1, es: J1, mt: M3 },
	[P4]: { bd: "json", ek: A1, es: J1, mt: M4 },
	[P5]: { ek: A2, es: J2, mt: M5 },
	[P6]: { ek: A2, es: J2, mt: M6 },
	[P7]: { bd: "json", ek: [T0,T3,T1,"rate_limited"], es: {"expired_token":T2,"forbidden":T3,"invalid_token":T2,"rate_limited":"too_many_requests"}, mt: M7 }
})

export type MetaShape = {
	operationId: "health.list" | "docs.list" | "feed.list" | "account.list" | "account.settings.create" | "resources.retrieve" | "resources.delete" | "resources.create"
} & Record<string, unknown>


export type RouteSelector = typeof P6 | typeof P3 | typeof P1 | typeof P2 | typeof P0 | typeof P5 | typeof P4 | typeof P7

export const meta: Record<string, MetaShape> = S({
	[P0]: M0,
	[P1]: M1,
	[P2]: M2,
	[P3]: M3,
	[P4]: M4,
	[P5]: M5,
	[P6]: M6,
	[P7]: M7
})

export const routeTree: RouteTree = { v: 2, root: tree, routes, meta }
