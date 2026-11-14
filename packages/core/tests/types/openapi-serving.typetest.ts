/** What serving a document takes at compile time: the docs map, and auth only where no public cache can hold it. */
import { expectTypeOf, test } from "vitest"
import { httpApp } from "../../src/routing/app.ts"
import { basic } from "../../src/openapi/auth.ts"
import { scalar } from "../../src/openapi/scalar.ts"
import { type ServeOpenApiOptions, serveOpenApi } from "../../src/openapi/serve.ts"
import { serveStaticOpenApi } from "../../src/openapi/static.ts"
import { swagger } from "../../src/openapi/swagger.ts"

const auth = basic({ realm: "Internal", verify: ({ password }) => password === "pw" })
const json = { inline: {} }

test("docs maps each path to its page, never a page alone", () => {
	expectTypeOf(scalar).toExtend<NonNullable<ServeOpenApiOptions["docs"]>[string]>()
	serveOpenApi(httpApp<{}>(), { docs: { "/scalar": scalar, "/swagger": swagger }, title: "T", version: "1" })
	serveStaticOpenApi(httpApp<{}>(), { docs: { "/docs": scalar }, json })
	// @ts-expect-error a page without its path
	serveOpenApi(httpApp<{}>(), { docs: scalar, title: "T", version: "1" })
	// @ts-expect-error a page without its path
	serveStaticOpenApi(httpApp<{}>(), { docs: swagger, json })
	// @ts-expect-error docsPath is gone: the path is the map's key
	serveStaticOpenApi(httpApp<{}>(), { docs: { "/docs": scalar }, docsPath: "/reference", json })
})

test("auth comes from basic() alone, and never beside a cacheControl", () => {
	expectTypeOf(auth).toEqualTypeOf<NonNullable<ServeOpenApiOptions["auth"]>>()
	serveOpenApi(httpApp<{}>(), { auth, title: "T", version: "1" })
	serveStaticOpenApi(httpApp<{}>(), { auth, json })
	serveStaticOpenApi(httpApp<{}>(), { cacheControl: "public, max-age=60", json })
	// @ts-expect-error cacheControl: a guarded document is never cached in public
	serveStaticOpenApi(httpApp<{}>(), { auth, cacheControl: "public, max-age=60", json })
	// @ts-expect-error a hand-built guard
	serveStaticOpenApi(httpApp<{}>(), { auth: { realm: "R" }, json })
})
