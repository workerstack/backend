import type { RouteTree, TreeNode } from "@workerstack/backend/http/tree"

function S<T>(o: Record<string, T>): Record<string, T> {
	return Object.assign(Object.create(null) as Record<string, T>, o)
}
function N(s: Record<string, TreeNode> = S({}), m: Record<string, string> | null = null, d: TreeNode["d"] = null, w: TreeNode["w"] = null, ws: string | null = null): TreeNode {
	return { d, m, s, w, ws }
}

const P0 = "GET /health"
const P1 = "GET /users/:id"
const P2 = "POST /echo"
const M0 = {"operationId":"health.list"} as unknown as MetaShape
const M1 = {"operationId":"users.retrieve"} as unknown as MetaShape
const M2 = {"operationId":"echo.create"} as unknown as MetaShape

export const tree: TreeNode = N(S({ "health": N(undefined, S({ GET: P0 })), "users": N(undefined, null, { n: "id", c: N(undefined, S({ GET: P1 })) }), "echo": N(undefined, S({ POST: P2 })) }))

export const routes: RouteTree["routes"] = S<RouteTree["routes"][string]>({
	[P0]: { mt: M0 },
	[P1]: { mt: M1 },
	[P2]: { mt: M2 }
})

export type MetaShape = {
	operationId: "health.list" | "users.retrieve" | "echo.create"
} & Record<string, unknown>


export type RouteSelector = typeof P0 | typeof P1 | typeof P2

export const meta: Record<string, MetaShape> = S({
	[P0]: M0,
	[P1]: M1,
	[P2]: M2
})

export const routeTree: RouteTree = { v: 2, root: tree, routes, meta }
