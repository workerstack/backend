import type { OperationCtx } from "@workerstack/backend/http";

/** A service outside the app module, typed by the route's operationId rather than by `typeof app`. */
export const Service = {
  list(ctx: OperationCtx<"hello.list">) {
    ctx.db.query(`WHERE q = ${ctx.input.search.q}`);

    return ctx.input.search.q;
  },
};
