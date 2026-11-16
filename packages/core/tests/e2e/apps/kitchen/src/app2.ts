import { defineErrors, defineTap, type MiddlewareFn, type OperationCtx } from "@workerstack/backend/http";
import * as z from "zod";

import { base, type DbCtx } from "./context";
import { Service } from "./service";

const helloErrors = defineErrors({ greeting_refused: "forbidden" });

/** The names the greeting tap saw, in order: what a tap observes after the answer went out. */
export const greetingLog: string[] = [];

const greetingTap = defineTap("greeting", z.object({ name: z.string() }), (_ctx, payload) => {
  greetingLog.push(payload.name);
});

/** The create group's own middleware: who greets, from `x-greeter`; refused without one. */
const withGreeter: MiddlewareFn<{ req: Request }, { greeter: string }> = (ctx, next) => {
  const greeter = ctx.req.headers.get("x-greeter");

  if (!greeter) throw helloErrors.greeting_refused();

  return next({ greeter });
};

/** A db that answers every query as audited: the same type as `db`, which is all `c.with` takes. */
function auditing(db: DbCtx["db"]): DbCtx["db"] {
  return { query: (sql) => [...db.query(sql), "audited"] };
}

/**
 * One step for both groups, typed by their two ids: it reads what the groups share (`db`, the declared
 * `greeting_refused`, `with` and `tap`), never `input` or `greeter`, which differ.
 */
function greet(c: OperationCtx<"hello.list" | "hello.create">, name: string): string {
  if (name === "nobody") throw c.errors.greeting_refused();
  const audited = c.with({ db: auditing(c.db) });
  c.tap(greetingTap, { name });

  return `hello ${name} (${audited.db.query(`greet ${name}`).join(",")})`;
}

/** The hello groups, fresh per call: `list` on `base()` alone, `create` behind `withGreeter` too. */
export function helloRoutes() {
  const list = base()
    .errorFactory(helloErrors)
    .tap(greetingTap)
    .get("/")
    .meta({ operationId: "hello.list" })
    .input({ search: z.object({ q: z.string() }) })
    .errors("greeting_refused")
    .output({ "application/json": { ok: z.object({ greeting: z.string(), q: z.string() }) } })
    .handler((c) => c.res.json("ok", { greeting: greet(c, c.input.search.q), q: Service.list(c) }));

  const create = base()
    .errorFactory(helloErrors)
    .tap(greetingTap)
    .use(withGreeter)
    .post("/")
    .meta({ invalidate: ["hello.list"], operationId: "hello.create" })
    .input({ json: z.object({ name: z.string() }) })
    .errors("greeting_refused")
    .output({ "application/json": { ok: z.object({ by: z.string(), created: z.string(), greeting: z.string() }) } })
    .handler((c) =>
      c.res.json("ok", { by: c.greeter, created: c.input.json.name, greeting: greet(c, c.input.json.name) }),
    );

  return { create, list };
}
