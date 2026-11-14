import { httpApp, type InferCtx, type MiddlewareFn } from "@workerstack/backend/http"

type Env = Record<string, unknown>

type DbCtx = { db: { query: (sql: string) => unknown[] } }
const withDb: MiddlewareFn<{}, DbCtx> = async (_ctx, next) => {
	return next({ db: { query: () => [] } })
}

export const base = httpApp<Env>().use(withDb)
export type AppCtx = InferCtx<typeof base>
