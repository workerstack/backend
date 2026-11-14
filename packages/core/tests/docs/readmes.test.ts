/**
 * The READMEs (bit 22, the owner's ruling): each npm package's README is that package's complete guide, since that
 * page is what npm shows, and the root one is a short repository overview that points at both packages. This file
 * holds them to it: core's README covers every subpath it exports, every value its root export holds and every `dx/`
 * area; the root one stays an overview and links both packages' guides. Every link
 * in them, the packaging doc and the exports page resolves, each page's contents matches its headings, and their code
 * blocks compile with the docs' (examples-compile.test.ts). What ships in each tarball is packaging.test.ts's.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { describe, expect, it } from "vitest"
import { blocksOf, READMES, REPO } from "./docs-blocks.ts"

const BLOB = "https://github.com/workerstack/backend/blob/main/"
/* the generator's pages live in its own repository */
const CLIENTS_BLOB = "https://github.com/workerstack/clients/blob/main/"
/* the pages whose links this file holds to resolving */
const LINKED = ["README.md", "packages/core/README.md", "packages/core/docs/packaging.md", "docs/packages.md"]
/* the root README is an overview: a guide that grew back into it would show up here first */
const OVERVIEW_LINES = 120

const read = (path: string) => readFileSync(join(REPO, path), "utf8")

/** Each link in `markdown` (at `page`) that names no file: `page target`; a site other than this repository's blob is skipped. */
export function brokenLinks(page: string, markdown: string, exists: (path: string) => boolean): string[] {
	return [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
		.map(([, target]) => target as string)
		.filter((target) => !target.startsWith("#"))
		.flatMap((target) => {
			const bare = target.split("#")[0] as string
			if (bare.startsWith(BLOB)) return [[target, bare.slice(BLOB.length)] as const]
			if (/^[a-z]+:/.test(bare)) return []
			return [[target, normalize(join(dirname(page), bare))] as const]
		})
		.filter(([, path]) => !exists(path))
		.map(([target]) => `${page} ${target}`)
}

const inRepo = (path: string) => existsSync(join(REPO, path))

/** A heading's GitHub anchor: lower-cased, anything but a word character, hyphen or space dropped, spaces hyphenated. */
export const slugOf = (heading: string): string =>
	heading
		.toLowerCase()
		.replaceAll(/[^\w\- ]+/g, "")
		.trim()
		.replaceAll(" ", "-")

/**
 * Where `markdown`'s table of contents and its headings disagree. The contents is every `- [text](#anchor)` line
 * before the first `##`, which is where it sits; the headings are every `##`/`###` after it. A heading left out, one
 * listed twice, a wrong order or an anchor that is not its heading's slug all show up here.
 */
export function tocDrift(markdown: string): string[] {
	const lines = markdown.split("\n")
	const firstHeading = lines.findIndex((line) => line.startsWith("## "))
	const listed = lines
		.slice(0, firstHeading === -1 ? lines.length : firstHeading)
		.flatMap((line) =>
			[...line.matchAll(/^\s*- \[([^\]]+)\]\(#([^)]+)\)/g)].map(([, text, anchor]) => ({ anchor, text })),
		)
	const headings = lines
		.slice(firstHeading === -1 ? 0 : firstHeading)
		.flatMap((line) => [...line.matchAll(/^(#{2,3}) (.+)$/g)].map(([, , text]) => text as string))
	const out: string[] = []
	for (const [at, heading] of headings.entries()) {
		const entry = listed[at]
		if (entry === undefined) out.push(`not in the contents: ${heading}`)
		else if (entry.text !== heading) out.push(`the contents reads ${entry.text} where the headings read ${heading}`)
		else if (entry.anchor !== slugOf(heading))
			out.push(`${heading}: the anchor is #${entry.anchor}, not #${slugOf(heading)}`)
	}
	for (const extra of listed.slice(headings.length)) out.push(`in the contents, not a heading: ${extra.text}`)
	return out
}

/** Every subpath `manifest` exports, as the specifier a user writes; the root export as `name` itself. */
export function specifiers(manifest: string, name: string): string[] {
	return Object.keys((JSON.parse(manifest) as { exports: Record<string, unknown> }).exports)
		.filter((subpath) => subpath !== "./package.json")
		.map((subpath) => `${name}/${subpath.slice(2)}`)
}

/**
 * The values `source` (an index module) exports, type-only exports left out: a page shows a value by calling it, and
 * a type by naming it in a signature, so only the values are a coverage rule a guide can be held to. The type
 * helpers have a table of their own below.
 */
export function valueExports(source: string): string[] {
	return source
		.replaceAll(/export type \{[^}]*\}/g, "")
		.split(/export \{/)
		.slice(1)
		.flatMap((rest) => (rest.split("}")[0] as string).split(","))
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "" && !entry.startsWith("type "))
}

/** The `dx/` areas: one file per public surface area, `README.md` being the index rather than an area. */
const dxAreas = (): string[] =>
	readFileSync(join(REPO, "blueprint/dx/README.md"), "utf8")
		.split("\n")
		.flatMap((line) => [...line.matchAll(/^\| `([a-z-]+)\.md` \|/g)].map(([, area]) => area as string))

describe("the npm READMEs are each their package's guide", () => {
	// v0: df3a620f4a
	/*
	 * Bit 22, the owner's ruling: npm shows the published package's own README, so each package's page is the
	 * complete guide for that package and bit 20's two caps on them are gone — the 120-line limit and the rule that
	 * a reference table lives only in docs/. What a reader must find in the first screen stays, and the coverage the
	 * caps used to stand in for is the compiled-block and coverage legs below.
	 */
	/* the SDK targets' matrix lives on the generator's codegen page, which the README links */
	// v0: d678624171
	it("core's README is the framework's guide: the tagged install, backend init, export default app, /docs, curl /health", () => {
		const readme = read("packages/core/README.md")
		const has = (pattern: RegExp) => pattern.test(readme)
		expect([
			has(/npm install @workerstack\/backend@next/),
			has(/release candidate/),
			has(/backend init/),
			has(/export default app/),
			has(/\/docs/),
			has(/\bcurl\b/),
			has(/\/health/),
			readme.includes(`${CLIENTS_BLOB}docs/codegen.md`),
		]).toEqual([true, true, true, true, true, true, true, true])
	})

	// v0: c64d56ae7d
	it("the root README stays an overview: both packages, both installs, develop, and no v0-only form", () => {
		const root = read("README.md")
		const has = (pattern: RegExp) => pattern.test(root)
		/* v0's README taught these, and 1.0 removed each (docs/migration.md) */
		const v0Only = [/app\.serve\(/, /\.ws\(["'/]/, /\.realtime\(/, /_v0\b/, /\/trust\b/].filter(has).map(String)
		expect([
			has(/\]\(packages\/core\/README\.md\)/),
			root.includes(`](${CLIENTS_BLOB}README.md)`),
			has(/npm install @workerstack\/backend@next/),
			has(/npm install --save-dev @workerstack\/clients@next/),
			has(/^## Develop$/m),
			has(/^## Releases$/m),
			v0Only,
			root.split("\n").length <= OVERVIEW_LINES,
		]).toEqual([true, true, true, true, true, true, [], true])
	})
})

describe("the READMEs' table of contents", () => {
	it("reads a heading left out, a wrong order, a stale anchor and an entry with no heading", () => {
		const page = "- [One](#one)\n- [Two](#two)\n\n## One\n\n## Two\n"
		expect(tocDrift(page)).toEqual([])
		expect(tocDrift(page.replace("- [Two](#two)\n", ""))).toEqual(["not in the contents: Two"])
		expect(tocDrift(page.replace("- [One](#one)\n- [Two](#two)", "- [Two](#two)\n- [One](#one)"))).toEqual([
			"the contents reads Two where the headings read One",
			"the contents reads One where the headings read Two",
		])
		expect(tocDrift(page.replace("(#two)", "(#too)"))).toEqual(["Two: the anchor is #too, not #two"])
		expect(tocDrift(`${page}`.replace("## Two\n", ""))).toEqual(["in the contents, not a heading: Two"])
	})

	it("slugs a heading the way GitHub does", () => {
		expect(["A route, end to end", "What is in the box", "`ctx.res.*`"].map(slugOf)).toEqual([
			"a-route-end-to-end",
			"what-is-in-the-box",
			"ctxres",
		])
	})

	it("holds both READMEs' contents to their headings", () => {
		for (const page of ["README.md", "packages/core/README.md"]) expect(tocDrift(read(page)), page).toEqual([])
	})
})

describe("the npm READMEs cover their package's surface", () => {
	/*
	 * The rule the owner asked for: a surface a package exports and its README never mentions is a surface nobody
	 * finds, since npm's page is where a reader starts. Each list is read from the package itself, so a new subpath,
	 * a new root value or a new `dx/` area reds here until the guide names it.
	 */
	it("core's README names every subpath it exports and every value its root export holds", () => {
		const readme = read("packages/core/README.md")
		const subpaths = specifiers(read("packages/core/package.json"), "@workerstack/backend")
		const values = valueExports(read("packages/core/src/index.ts"))
		expect([
			subpaths.length > 40,
			subpaths.filter((name) => !readme.includes(name)),
			values.length > 5,
			values.filter((name) => !new RegExp(`\\b${name}\\b`).test(readme)),
		]).toEqual([true, [], true, []])
	})

	it("core's README links the docs page of every dx/ area", () => {
		const readme = read("packages/core/README.md")
		const areas = dxAreas()
		expect([areas.length > 15, areas.filter((area) => !readme.includes(`${BLOB}docs/${area}.md`))]).toEqual([true, []])
	})

	it("reads the surfaces it checks from the packages themselves, not from a list of its own", () => {
		expect(specifiers('{"exports":{"./http":{},"./ws/bun":{},"./package.json":"x"}}', "pkg")).toEqual([
			"pkg/http",
			"pkg/ws/bun",
		])
		const index = ['export { httpApp, type HttpApp } from "./a.ts"', "export type {\n\tOne,\n} from './b.ts'"].join(
			"\n",
		)
		expect(valueExports(index)).toEqual(["httpApp"])
	})
})

describe("the READMEs show working code", () => {
	/*
	 * Not vacuous: the package's README must carry at least one block the docs' tests compile.
	 * `examples-compile.test.ts` type-checks every `ts` block of every page including these, but a README with no
	 * fenced TypeScript at all would pass it by having nothing to check. This is the leg that notices.
	 */
	it("the package README carries a block the tests compile, and names the pages that do not", () => {
		const compiled = new Set(["ts", "ts run"])
		const without = READMES.filter(
			(page) => inRepo(page) && !blocksOf(page, read(page)).some((block) => compiled.has(block.info)),
		)
		/*
		 * The package README carries compiled code. The two below do not, and are pinned rather than excused: the
		 * root README is an overview whose code lives in the package guides, and packaging.md is prose about
		 * tarballs, so when either gains a TypeScript block this leg reds and whoever added it tightens the list.
		 */
		expect(without).toEqual(["README.md", "packages/core/docs/packaging.md"])
		expect(blocksOf("packages/core/README.md", read("packages/core/README.md")).some((b) => compiled.has(b.info))).toBe(
			true,
		)
	})
})

describe("the READMEs' links", () => {
	it("resolve, in the READMEs, the packaging doc and the exports page", () => {
		expect(LINKED.flatMap((page) => brokenLinks(page, read(page), inRepo))).toEqual([])
	})

	it("report a broken one by page and target, relative or a blob URL", () => {
		const page = [
			"[ok](docs/README.md)",
			`[gone](${BLOB}docs/nowhere.md)`,
			"[also gone](missing.md#a)",
			"[site](https://npmjs.com)",
		]
		expect(brokenLinks("README.md", page.join("\n"), inRepo)).toEqual([
			`README.md ${BLOB}docs/nowhere.md`,
			"README.md missing.md#a",
		])
	})
})

describe("the exports page", () => {
	it("lists every subpath the package exports", () => {
		const page = read("docs/packages.md")
		const all = specifiers(read("packages/core/package.json"), "@workerstack/backend")
		expect(all.filter((name) => !page.includes(`\`${name}\``))).toEqual([])
	})
})
