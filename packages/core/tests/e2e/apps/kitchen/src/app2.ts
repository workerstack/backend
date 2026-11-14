import {
	defineErrors,
	defineTap,
	type InferCtx,
	type InferEnv,
	type InferMethods,
	type InferRouteInput,
	type InferRouteMethods,
	type InferRouteOutput,
	type InferRoutePaths,
	type InferRoutes,
	type MiddlewareFn,
	type OperationCtx,
} from "@workerstack/backend/http"
import * as z from "zod"
import { base, type DbCtx } from "./context"
import { Service } from "./service"

const helloErrors = defineErrors({ greeting_refused: "forbidden" })

/** The names the greeting tap saw, in order: what a tap observes after the answer went out. */
export const greetingLog: string[] = []

export const greetingTap = defineTap("greeting", z.object({ name: z.string() }), (_ctx, payload) => {
	greetingLog.push(payload.name)
})

/** The create group's own middleware: who greets, from `x-greeter`; refused without one. */
const withGreeter: MiddlewareFn<{ req: Request }, { greeter: string }> = (ctx, next) => {
	const greeter = ctx.req.headers.get("x-greeter")
	if (!greeter) throw helloErrors.greeting_refused()
	return next({ greeter })
}

/** A db that answers every query as audited: the same type as `db`, which is all `c.with` takes. */
function auditing(db: DbCtx["db"]): DbCtx["db"] {
	return { query: (sql) => [...db.query(sql), "audited"] }
}

/**
 * One step for both groups, typed by their two ids: it reads what the groups share (`db`, the declared
 * `greeting_refused`, `with` and `tap`), never `input` or `greeter`, which differ.
 */
export function greet(c: OperationCtx<"hello.list" | "hello.create">, name: string): string {
	if (name === "nobody") throw c.errors.greeting_refused()
	const audited = c.with({ db: auditing(c.db) })
	c.tap(greetingTap, { name })
	return `hello ${name} (${audited.db.query(`greet ${name}`).join(",")})`
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
		.handler((c) => c.res.json("ok", { greeting: greet(c, c.input.search.q), q: Service.list(c) }))
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
		)
	return { create, list }
}

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

type List = ReturnType<typeof helloRoutes>["list"]
type Create = ReturnType<typeof helloRoutes>["create"]

/* InferCtx — accumulated middleware context, per group */
type Ctx = InferCtx<List>
type _Ctx = Expect<Ctx extends DbCtx ? true : false>
type _CreateCtx = Expect<InferCtx<Create> extends DbCtx & { greeter: string } ? true : false>

/* InferEnv — env bindings */
type E = InferEnv<List>
type _E = Expect<Eq<E, Record<string, unknown>>>

/* InferMethods — all HTTP methods used */
type M = InferMethods<List>
type _M = Expect<Eq<M, "get">>

/* InferRoutes — full route map */
type Routes = InferRoutes<List>
type _Routes = Expect<Eq<Routes, never> extends true ? false : true>

/* InferRoutePaths — registered path literals */
type Paths = InferRoutePaths<List>
type _Paths = Expect<Eq<Paths, "/">>

/* InferRouteMethods — methods for a path */
type Methods = InferRouteMethods<Create, "/">
type _Methods = Expect<Eq<Methods, "post">>

/* OperationCtx — one id's handler context, from the generated slot */
type HelloCtx = OperationCtx<"hello.list">
type _HelloCtx = Expect<HelloCtx extends DbCtx & { input: { search: { q: string } } } ? true : false>

/* OperationCtx over two ids — only what both groups share */
type StepCtx = OperationCtx<"hello.list" | "hello.create">
type _StepDb = Expect<StepCtx extends DbCtx ? true : false>
type _StepNoGreeter = Expect<"greeter" extends keyof StepCtx ? false : true>
type _StepNoInput = Expect<"input" extends keyof StepCtx ? false : true>

/* InferRouteInput — input schema for path+method */
type HelloInput = InferRouteInput<List, "/", "get">
type HelloPostInput = InferRouteInput<Create, "/", "post">
type _HelloInput = Expect<Eq<HelloInput, { readonly search: { q: string } }>>
type _HelloPostInput = Expect<Eq<HelloPostInput, { readonly json: { name: string } }>>

/* InferRouteOutput — output schema for path+method */
type HelloOutput = InferRouteOutput<List, "/", "get">
type _HelloOutput = Expect<HelloOutput extends { "application/json": { ok: unknown } } ? true : false>

export type { Ctx, E, HelloCtx, HelloInput, HelloOutput, M, Methods, Paths, Routes, StepCtx }
