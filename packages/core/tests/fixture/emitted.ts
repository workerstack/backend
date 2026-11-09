/*
 * copied from @workerstack/clients's src/emit/mcp/__fixtures__/written.ts (scratchDir, written) and
 * @workerstack/clients's src/emit/ts/__fixtures__/emitted.ts (emittedRouteTree) at b7c1db40: each package owns its test fixtures
 * (roadmap 5 D7). The emitters themselves come from @workerstack/clients by name.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import type { RouteTree } from "@workerstack/clients"

/** A fresh directory under the toolchain cache. */
export const scratchDir = (name: string): string => {
	const root = join(process.env.HOME ?? "", ".cache/honey-tmp/gen-mcp")
	mkdirSync(root, { recursive: true })
	return mkdtempSync(join(root, `${name}-`))
}

/** `files` written into a fresh directory: its path. */
export function written(files: Readonly<Record<string, string>>): string {
	const dir = scratchDir("server")
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, path)), { recursive: true })
		writeFileSync(join(dir, path), text)
	}
	return dir
}

/** Where emitted files land: under the toolchain cache, never /tmp. */
const root = () => join(process.env.HOME ?? homedir(), ".cache/honey-tmp/gen-ts")

/** Write `files` once per content; the path of `entry` among them. */
function writtenEntry(files: Readonly<Record<string, string>>, entry: string): string {
	const ordered = Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	const hash = createHash("sha256").update(JSON.stringify(ordered)).digest("hex").slice(0, 20)
	const dir = join(root(), hash)
	if (!existsSync(join(dir, entry))) {
		mkdirSync(dir, { recursive: true })
		/* write each file beside its final name, then rename: a parallel worker never reads half a file */
		for (const [name, text] of ordered) {
			const partial = join(dir, `${name}.${process.pid}.partial`)
			writeFileSync(partial, text)
			renameSync(partial, join(dir, name))
		}
	}
	return join(dir, entry)
}

/** The `routes.gen.ts` module `generateRouteTree` writes for `tree`, imported, with its text. */
export async function emittedRouteTree(tree: RouteTree): Promise<Record<string, unknown> & { text: string }> {
	const { generateRouteTree } = await import("@workerstack/clients")
	const text = generateRouteTree(tree)
	return {
		...((await import(writtenEntry({ "routes.gen.ts": text }, "routes.gen.ts"))) as Record<string, unknown>),
		text,
	}
}
