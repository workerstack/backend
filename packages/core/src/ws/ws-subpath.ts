/**
 * `@workerstack/backend/ws`: the WebSocket surface in one entry, `ws(app, path)` for a route and
 * `workersWebSocket()` for the Worker's upgrade. An app that never opens a socket imports neither.
 */
export { type AnyHoneyHandle, type WsRouteOf, ws } from "./route.ts"
export { workersWebSocket } from "./workers.ts"
