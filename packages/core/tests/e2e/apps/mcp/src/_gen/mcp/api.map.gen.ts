import { sseOp, type ServiceMap } from "./api.runtime.gen.js"

export const serviceMap: ServiceMap = {
	extract: {
		once: {
			method: "POST",
			params: ["project_id"],
			path: "/v1/projects/{project_id}/extract",
		},
		stream: {
			call: sseOp,
			method: "POST",
			params: ["project_id"],
			path: "/v1/projects/{project_id}/extract-stream",
			sse: [],
		},
		table: {
			once: {
				method: "POST",
				params: ["project_id", "table_id"],
				path: "/v1/projects/{project_id}/tables/{table_id}/extract",
			},
			stream: {
				call: sseOp,
				method: "POST",
				params: ["project_id", "table_id"],
				path: "/v1/projects/{project_id}/tables/{table_id}/extract-stream",
				sse: [],
			},
		},
	},
	suggest: {
		schema: {
			method: "POST",
			params: ["project_id"],
			path: "/v1/projects/{project_id}/suggest-schema",
		},
	},
}
