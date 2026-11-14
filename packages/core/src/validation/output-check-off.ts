/**
 * `#output-check` under the `backend-no-output-check` condition: no route checks what it answers. A Vite production
 * build through `backendPlugin()` resolves this module. The check every `.output()` route runs on a `forward()`ed answer is no part
 * of it and stays.
 */
import type { OutputCheck } from "./validate-output.ts"

/** No check for any route: each answer goes out as its handler built it. */
export function outputCheck(): OutputCheck | null {
	return null
}
