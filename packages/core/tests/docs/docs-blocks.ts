/**
 * The docs' pages and code blocks (bit 20), read by core's docs tests: every markdown page under docs/ and the
 * READMEs, each fenced block with its info string and where it starts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"

export const REPO = /* @__PURE__ */ resolve(import.meta.dirname, "../../../..")
export const DOCS = /* @__PURE__ */ join(REPO, "docs")

/** A fenced block: its page and line, its info string (`ts`, `ts run`, `sh`, …) and its code. */
export type Block = { readonly at: string; readonly code: string; readonly info: string }

/** Every markdown file under `dir`, repo-relative, sorted; none when `dir` is absent. */
function pagesUnder(dir: string = DOCS): string[] {
	if (!existsSync(dir)) return []
	return readdirSync(dir)
		.flatMap((name) => {
			const path = join(dir, name)
			if (statSync(path).isDirectory()) return pagesUnder(path)
			return name.endsWith(".md") ? [relative(REPO, path)] : []
		})
		.sort()
}

/** The fenced blocks of `markdown` (page `page`), in order; a fence left open ends at the page's end. */
export function blocksOf(page: string, markdown: string): Block[] {
	const blocks: Block[] = []
	let open: { at: string; info: string; lines: string[] } | undefined
	for (const [index, line] of markdown.split("\n").entries()) {
		if (open === undefined) {
			const fence = /^```(.*)$/.exec(line)
			if (fence) open = { at: `${page}:${index + 1}`, info: (fence[1] ?? "").trim(), lines: [] }
			continue
		}
		if (line === "```") {
			blocks.push({ at: open.at, code: `${open.lines.join("\n")}\n`, info: open.info })
			open = undefined
		} else open.lines.push(line)
	}
	if (open) blocks.push({ at: open.at, code: `${open.lines.join("\n")}\n`, info: open.info })
	return blocks
}

/** The READMEs and the packaging doc, outside docs/ but compiled with it (bit 20 d). */
export const READMES = ["README.md", "packages/core/README.md", "packages/core/docs/packaging.md"]

/** Every page's blocks: docs/ and the READMEs. */
export const allBlocks = (pages: readonly string[] = [...pagesUnder(), ...READMES]): Block[] =>
	pages.flatMap((page) => blocksOf(page, readFileSync(join(REPO, page), "utf8")))
