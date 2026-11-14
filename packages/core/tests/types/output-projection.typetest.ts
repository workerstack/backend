/**
 * `.output(schemas, { projection })`, as typed: the projection reads the route's ctx, `.input()`'s typed search
 * included, and answers an `HttpProjection` or `null`; comb's `FieldSelection` passes as an `HttpSelection` with no adapter.
 * Checked by typecheck.
 */
import { describe, expectTypeOf, it } from "vitest"
import * as z from "zod"
import type { OutputOptions, HttpProjection, HttpSelection } from "../../src/index.ts"
import { httpApp } from "../../src/routing/app.ts"

/* comb's `FieldSelection` (comb packages/core/src/query/types.ts:8), copied: backend does not depend on comb */
type CombFieldSelection = { relations: Record<string, CombFieldSelection | null>; scalars: string[] }

/* an answer with no `select` */
const noSelect = () => ({ at: "items" })

describe(".output()'s projection option", () => {
	const page = z.object({ items: z.array(z.object({ id: z.string() })) })

	it("reads the route's typed search and answers an HttpProjection or null", () => {
		const app = httpApp<{}>()
		app
			.get("/a")
			.input({ search: z.object({ select: z.string().optional() }) })
			.output(
				{ ok: page },
				{
					projection: (ctx) => {
						expectTypeOf(ctx.input.search.select).toEqualTypeOf<string | undefined>()
						return ctx.input.search.select === undefined
							? null
							: { at: "items", select: { relations: {}, scalars: [ctx.input.search.select] } }
					},
				},
			)
			.handler((c) => c.res.json("ok", { items: [] }))
	})

	it("refuses an answer that is no HttpProjection", () => {
		expectTypeOf(noSelect).not.toExtend<NonNullable<OutputOptions<{}>["projection"]>>()
		httpApp<{}>()
			.get("/b")
			// @ts-expect-error a projection answers `{ at?, select }` or null
			.output({ ok: page }, { projection: noSelect })
			.handler((c) => c.res.json("ok", { items: [] }))
	})

	it("takes comb's FieldSelection as an HttpSelection", () => {
		expectTypeOf<CombFieldSelection>().toExtend<HttpSelection>()
		expectTypeOf<{ at: "items"; select: CombFieldSelection }>().toExtend<HttpProjection>()
		expectTypeOf<OutputOptions<{}>>().toEqualTypeOf<{ readonly projection?: (ctx: {}) => HttpProjection | null }>()
	})
})
