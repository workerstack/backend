/**
 * The public inference types as the kitchen app reads its hello groups (src/app2.ts), checked by this app's
 * `type:check` (typecheck:consumers), never run.
 */
import type {
  InferCtx,
  InferEnv,
  InferMethods,
  InferRouteInput,
  InferRouteMethods,
  InferRouteOutput,
  InferRoutePaths,
  InferRoutes,
  OperationCtx,
} from "@workerstack/backend/http";

import type { helloRoutes } from "../../src/app2";
import type { DbCtx } from "../../src/context";

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

type List = ReturnType<typeof helloRoutes>["list"];

type Create = ReturnType<typeof helloRoutes>["create"];

// InferCtx — accumulated middleware context, per group
type Ctx = InferCtx<List>;

type _Ctx = Expect<Ctx extends DbCtx ? true : false>;

type _CreateCtx = Expect<InferCtx<Create> extends DbCtx & { greeter: string } ? true : false>;

// InferEnv — env bindings
type E = InferEnv<List>;

type _E = Expect<Eq<E, Record<string, unknown>>>;

// InferMethods — all HTTP methods used
type M = InferMethods<List>;

type _M = Expect<Eq<M, "get">>;

// InferRoutes — full route map
type Routes = InferRoutes<List>;

type _Routes = Expect<Eq<Routes, never> extends true ? false : true>;

// InferRoutePaths — registered path literals
type Paths = InferRoutePaths<List>;

type _Paths = Expect<Eq<Paths, "/">>;

// InferRouteMethods — methods for a path
type Methods = InferRouteMethods<Create, "/">;

type _Methods = Expect<Eq<Methods, "post">>;

// OperationCtx — one id's handler context, from the generated slot
type HelloCtx = OperationCtx<"hello.list">;

type _HelloCtx = Expect<HelloCtx extends DbCtx & { input: { search: { q: string } } } ? true : false>;

// OperationCtx over two ids — only what both groups share
type StepCtx = OperationCtx<"hello.list" | "hello.create">;

type _StepDb = Expect<StepCtx extends DbCtx ? true : false>;

type _StepNoGreeter = Expect<"greeter" extends keyof StepCtx ? false : true>;

type _StepNoInput = Expect<"input" extends keyof StepCtx ? false : true>;

// InferRouteInput — input schema for path+method
type HelloInput = InferRouteInput<List, "/", "get">;

type HelloPostInput = InferRouteInput<Create, "/", "post">;

type _HelloInput = Expect<Eq<HelloInput, { readonly search: { q: string } }>>;

type _HelloPostInput = Expect<Eq<HelloPostInput, { readonly json: { name: string } }>>;

// InferRouteOutput — output schema for path+method
type HelloOutput = InferRouteOutput<List, "/", "get">;

type _HelloOutput = Expect<HelloOutput extends { "application/json": { ok: unknown } } ? true : false>;

/** Every assertion above, exported so each one is checked and none reads as unused. */
export type TypeAssertions = [
  _Ctx,
  _CreateCtx,
  _E,
  _M,
  _Routes,
  _Paths,
  _Methods,
  _HelloCtx,
  _StepDb,
  _StepNoGreeter,
  _StepNoInput,
  _HelloInput,
  _HelloPostInput,
  _HelloOutput,
];
