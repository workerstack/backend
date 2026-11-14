import { sseOp, wsOp, type ServiceMap } from "./kitchen.runtime.gen.js"

export const serviceMap: ServiceMap = {
	boundary: {
		custom: {
			list: {
				empty: true,
				method: "GET",
				path: "/api/boundary/custom",
			},
		},
		default: {
			list: {
				empty: true,
				method: "GET",
				path: "/api/boundary/default",
			},
		},
	},
	echoWs: {
		connect: {
			call: wsOp,
			method: "GET",
			path: "/api/echo-ws",
			ws: true,
		},
	},
	echo_delete: {
		empty: true,
		method: "DELETE",
		path: "/api/echo",
	},
	echo_get: {
		empty: true,
		method: "GET",
		path: "/api/echo",
	},
	echo_patch: {
		empty: true,
		method: "PATCH",
		path: "/api/echo",
	},
	echo_post: {
		empty: true,
		method: "POST",
		path: "/api/echo",
	},
	echo_put: {
		empty: true,
		method: "PUT",
		path: "/api/echo",
	},
	events: {
		list: {
			call: sseOp,
			method: "GET",
			path: "/api/events",
			sse: true,
		},
	},
	eventsLive: {
		list: {
			call: sseOp,
			method: "GET",
			path: "/api/events-live",
			sse: true,
		},
	},
	health: {
		check: {
			empty: true,
			method: "GET",
			path: "/api/health",
		},
	},
	organizations: {
		create: {
			empty: true,
			method: "POST",
			path: "/api/v1/organizations",
		},
		delete: {
			empty: true,
			method: "DELETE",
			params: ["orgId"],
			path: "/api/v1/organizations/{orgId}",
		},
		list: {
			empty: true,
			method: "GET",
			path: "/api/v1/organizations",
		},
		retrieve: {
			empty: true,
			method: "GET",
			params: ["orgId"],
			path: "/api/v1/organizations/{orgId}",
		},
	},
	realtime: {
		broadcast: {
			create: {
				empty: true,
				method: "POST",
				params: ["topic"],
				path: "/api/realtime/broadcast/{topic}",
			},
		},
		chat: {
			connect: {
				call: wsOp,
				method: "GET",
				params: ["roomId"],
				path: "/api/realtime/chat/{roomId}",
				ws: true,
			},
		},
		echo: {
			connect: {
				call: wsOp,
				method: "GET",
				path: "/api/realtime/echo",
				ws: true,
			},
		},
	},
	reconnectWs: {
		connect: {
			call: wsOp,
			method: "GET",
			path: "/api/reconnect-ws",
			ws: true,
		},
	},
	root: {
		list: {
			method: "GET",
			path: "/api",
		},
	},
	v1: {
		socket: {
			connect: {
				call: wsOp,
				method: "GET",
				path: "/api/v1/socket",
				ws: true,
			},
		},
	},
}
