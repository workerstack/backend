/**
 * backend/export-name: a name a public entry exports is specific to this package, never a bare one-word name that
 * collides with a consumer's own or a Cloudflare Workers type. Through real oxlint, because the rule reads the
 * package.json entries and an `export *` target from disk.
 */
import { describe, expect, it } from "vitest"
import { SPAWN_TIMEOUT } from "../tests/fixture/spawn-timeout.ts"
import { type Fixture, oxlintReports } from "./rule-harness.ts"

const MANIFEST = JSON.stringify({
	exports: { ".": { "backend-source": "./src/index.ts" }, "./http": { "backend-source": "./src/http.ts" } },
})

const bare = (name: string, entry = ".") =>
	`\`${name}\` is exported from "${entry}" as a bare name: a consumer's own ${name} collides with it, so name it for what it is (OtelSpan, not Span)`
const workers = (name: string, entry = ".") =>
	`\`${name}\` is exported from "${entry}" under the name of a Cloudflare Workers type, so a consumer importing both collides: name it for what it is`

const messages = (fixture: Fixture) =>
	oxlintReports("export-name", { "package.json": MANIFEST, ...fixture }).map((report) => report.message)

describe("backend/export-name: the names it reports", { timeout: SPAWN_TIMEOUT }, () => {
	it("reports a bare one-word name and a Workers type name (Span is one) exported from an entry", () => {
		const code = "export type Span = {}\nexport interface ExecutionContext {}\nexport type Projection = {}\n"
		expect(messages({ "src/index.ts": code })).toEqual([
			workers("Span"),
			workers("ExecutionContext"),
			bare("Projection"),
		])
	})

	it("reports a bare class and const, and a bare name a re-export carries", () => {
		const code =
			'export class Preset {}\nexport const Timing = 1\nexport type { Jwk } from "./a.ts"\nexport { Tracer as Selection } from "./a.ts"\n'
		expect(messages({ "src/index.ts": code })).toEqual([bare("Preset"), bare("Timing"), bare("Jwk"), bare("Selection")])
	})

	it("reports the names an export star carries into the entry, naming the entry", () => {
		const fixture = {
			"src/http.ts": 'export * from "./a.ts"\n',
			"src/index.ts": "export {}\n",
			"src/a.ts": "export type Projection = {}\nexport const ok = 1\n",
		}
		expect(messages(fixture)).toEqual([bare("Projection", "./http")])
	})

	it("reports a namespace re-export and a string-named export by the name the consumer imports", () => {
		const code =
			'export * as Preset from "./a.ts"\nexport * as "Timing" from "./a.ts"\nconst projection = 1\nexport { projection as "Projection" }\n'
		expect(messages({ "src/index.ts": code, "src/a.ts": "export const ok = 1\n" })).toEqual([
			bare("Preset"),
			bare("Timing"),
			bare("Projection"),
		])
	})

	it("follows a star cycle once and leaves a package's star alone", () => {
		const fixture = {
			"src/index.ts": 'export * from "./a.ts"\nexport * from "zod"\n',
			"src/a.ts": 'export * from "./b.ts"\nexport type Projection = {}\n',
			"src/b.ts": 'export * from "./a.ts"\nexport type Tracer = {}\n',
		}
		expect(messages(fixture)).toEqual([bare("Projection"), bare("Tracer")])
	})

	it("passes specific names", () => {
		const code = "export type OtelSpan = {}\nexport class HttpError {}\nexport const defineCron = 1\n"
		expect(messages({ "src/index.ts": code })).toEqual([])
	})
})

describe("backend/export-name: the files it checks", { timeout: SPAWN_TIMEOUT }, () => {
	it("passes a bare name in a file that is not an entry", () => {
		expect(messages({ "src/index.ts": "export {}\n", "src/span.ts": "export type Projection = {}\n" })).toEqual([])
	})

	it("checks only the files an entry's source condition names", () => {
		const manifest = JSON.stringify({
			exports: {
				".": { "backend-source": "./src/index.ts" },
				"./built": { default: "./dist/built.js" },
				"./package.json": "./package.json",
			},
		})
		const fixture = {
			"package.json": manifest,
			"src/index.ts": "export {}\n",
			"dist/built.js": "export const Projection = 1\n",
		}
		expect(oxlintReports("export-name", fixture)).toEqual([])
	})

	it("passes a file in no package that ships its source", () => {
		expect(oxlintReports("export-name", { "src/index.ts": "export type Projection = {}\n" })).toEqual([])
	})
})
