import { definePreset, httpApp, type MiddlewareFn } from "@workerstack/backend/http";
import { requestId } from "@workerstack/backend/http/request-id";

type Env = Record<string, unknown>;

export type DbCtx = { db: { query: (sql: string) => unknown[] } };

const withDb: MiddlewareFn<{}, DbCtx> = async (_ctx, next) => {
  return next({ db: { query: () => [] } });
};

// the chain every kitchen request runs before its own: a group carries it itself, so it mounts on the app's bare root
// and each middleware runs once (`route()` types a sub as the receiver's ctx, which the root adds nothing to)
const kitchen = definePreset<Env>().use(requestId());

/** A fresh handle per call: each `createApp` mounts groups built on its own, so no handle registers a route twice. */
export const base = () => httpApp(kitchen).use(withDb);
