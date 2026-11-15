/**
 * `#output-check` under the `backend-no-output-check` condition: no route checks what it answers. A Vite production
 * build through `backendPlugin()` resolves this module. The check every `.output()` route runs on a `forward()`ed answer is no part
 * of it and stays.
 */
import type { SseCheck } from "../response/sse.ts"
import type { SendCheck } from "../ws/messages.ts"
import type { OutputCheck } from "./validate-output.ts"

/** No check for any route: each answer goes out as its handler built it. */
export function outputCheck(): OutputCheck | null {
	return null
}

/** No check for any event stream: each event goes out as its handler sent it. */
export function sseCheck(): SseCheck | null {
	return null
}

/** No check for any ws route: each message goes out as its handler sent it. */
export function wsSendCheck(): SendCheck | null {
	return null
}
