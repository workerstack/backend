/**
 * Every e2e app but the one a `type-check.ts` program checks: the `createApp` that `load.ts` and `src/worker.ts` call,
 * typed by what they read from it. One program holds one app's generated `HttpCodegen` slot, as a real worker does; a
 * second app's slot would collide with it (TS2717), and with none an app's `OperationCtx` reads fall back.
 */
import type { WSAdapter } from "@workerstack/backend/http"

/** The member `src/worker.ts` calls on an app. */
export type E2eApp = { fetch(request: Request, env: never, ctx?: unknown): Promise<Response> }

export declare function createApp(wsAdapter?: WSAdapter): E2eApp
