/**
 * Which issue of a projected answer its projection explains. A sparse fieldset cuts each row to the fields a request
 * selects while the route declares the whole row, so a row's missing field is an issue the check expects. Only that
 * issue is: the key is absent from a row of the projection (or of a relation it embeds), and that level's selection
 * neither names it nor selects everything. Every other issue, an envelope's included, stays a failure. Reached only
 * through `#output-check`, so a build without the check carries none of this.
 */
import type { Projection, Selection } from "../routing/output-types.ts"
import type { StandardSchemaIssue } from "./standard-schema.ts"

type Segment = NonNullable<StandardSchemaIssue["path"]>[number]

/** A path step's key: Standard Schema writes one bare or as `{ key }`. */
function keyOf(segment: Segment): PropertyKey {
	return typeof segment === "object" ? segment.key : segment
}

function isRow(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Whether `select` keeps `key`: a scalar it names (`@key`, a computed field, counts), or a relation it embeds. */
function keeps(select: Selection, key: string): boolean {
	return (
		select.scalars.includes("*") ||
		select.scalars.includes(key) ||
		select.scalars.includes(`@${key}`) ||
		Object.hasOwn(select.relations, key)
	)
}

/** Whether `path` from step `at` is a key `row` lacks and `select` left out, through the relations `select` embeds. */
function cut(path: readonly PropertyKey[], at: number, row: unknown, select: Selection): boolean {
	const key = path[at]
	if (!isRow(row) || typeof key !== "string") return false
	if (at === path.length - 1) return !Object.hasOwn(row, key) && !keeps(select, key)
	const nested = Object.hasOwn(select.relations, key) ? select.relations[key] : null
	/* a relation selected whole, or with `*`, is passed on as stored: nothing in it was cut */
	if (nested === null || nested === undefined || nested.scalars.includes("*")) return false
	const value = row[key]
	if (!Array.isArray(value)) return cut(path, at + 1, value, nested)
	const index = path[at + 1]
	return typeof index === "number" && cut(path, at + 2, value[index], nested)
}

/** Whether `issue`, raised on `data`, is a field `projection` cut from a row. */
export function projected(issue: StandardSchemaIssue, data: unknown, projection: Projection): boolean {
	const path = (issue.path ?? []).map(keyOf)
	if (projection.at === undefined) return cut(path, 0, data, projection.select)
	const rows = isRow(data) ? data[projection.at] : undefined
	const index = path[1]
	if (path[0] !== projection.at || !Array.isArray(rows) || typeof index !== "number") return false
	return cut(path, 2, rows[index], projection.select)
}
