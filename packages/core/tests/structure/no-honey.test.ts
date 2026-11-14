import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, matchesGlob, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { brandTokens, spansOf } from "../../../../scripts/brand-names.ts"
import { SPAWN_TIMEOUT } from "../fixture/spawn-timeout.ts"

/*
 * The package was honey before it was @workerstack/backend. Every name it had (the bin, the env prefix, the wire
 * headers, the export conditions, the exports, the paths and the prose) moved with it, so a honey token anywhere live
 * is a name the rename missed. scripts/brand-names.ts says what is history and may keep it.
 *
 * Two earlier facts stay checked: honey moved to the workerstack org in 1.0.0-rc.23 (@lovrozagar/honey is
 * @workerstack/backend, @lovrozagar/honey-clients is @workerstack/clients, and the repo is
 * github.com/workerstack/backend), and the old name stays only where history is recorded: the changelog, the migration
 * notes (migration.md's before blocks are the code a v0 or rc user wrote; its after blocks are compiled, so an old name
 * there fails the docs tests), the blueprint and the lessons' evidence.
 */

const REPO = resolve(import.meta.dirname, "../../../..")
const SELF = "packages/core/tests/structure/no-honey.test.ts"

const OLD = /lovrozagar(?:\\?\/|-)honey|lovrozagar%2fhoney/i /* \/ too: a regex literal escapes the slash */
const HISTORY = [
	"CHANGELOG.md",
	"docs/migrating-from-honey.md",
	"docs/migrating-to-workerstack.md",
	"docs/migration.md",
]
const HISTORY_TREES = ["blueprint/", ".rulesync/lessons/"]

/** Whether `file` records history, where the old name stays. */
function historical(file: string): boolean {
	return HISTORY.includes(file) || HISTORY_TREES.some((tree) => file.startsWith(tree))
}

/** Every file git tracks or would add, but this guard, which spells what it refuses. */
function tracked(): string[] {
	const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
		cwd: REPO,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	})
	return out.split("\0").filter((file) => file !== "" && file !== SELF)
}

/** Each place `file` names the old package or repo, as `<file>:<line> names …`. */
function named(file: string): string[] {
	const path = join(REPO, file)
	if (!existsSync(path)) return []
	const bytes = readFileSync(path)
	if (bytes.includes(0)) return []
	return bytes
		.toString("utf8")
		.split("\n")
		.flatMap((line, i) =>
			OLD.test(line)
				? [
						`${file}:${i + 1} names lovrozagar/honey: it is @workerstack/backend (or @workerstack/clients, github.com/workerstack/backend) since 1.0.0-rc.23`,
					]
				: [],
		)
}

/** Each live honey token in a file, as `path: token`. */
function liveHits(path: string, text: string): string[] {
	return spansOf(path, text)
		.filter((span) => span.live)
		.flatMap((span) => brandTokens(span.text, "honey"))
		.map((token) => `${path}: ${token}`)
}

/** The `paths:` globs in a lesson's frontmatter that match no tracked file. */
export function danglingGlobs(lesson: string, files: readonly string[]): string[] {
	const line = /^paths:\s*(\[.*\])\s*$/m.exec(lesson)?.[1]
	if (!line) return []
	const globs = JSON.parse(line) as string[]
	return globs.filter((glob) => !files.some((file) => matchesGlob(file, glob)))
}

describe("no honey", () => {
	it("no file outside the history names @lovrozagar/honey or its repo", { timeout: SPAWN_TIMEOUT }, () => {
		expect(
			tracked()
				.filter((file) => !historical(file))
				.flatMap(named),
		).toEqual([])
	})

	it("every history exemption is a file or tree that exists", () => {
		expect(HISTORY.filter((file) => !existsSync(join(REPO, file)))).toEqual([])
		expect(HISTORY_TREES.filter((tree) => !existsSync(join(REPO, tree)))).toEqual([])
	})

	it("leaves no honey token in a live span of a tracked text file", { timeout: SPAWN_TIMEOUT }, () => {
		const hits = tracked().flatMap((path) => {
			const bytes = readFileSync(join(REPO, path))
			return bytes.subarray(0, 8192).includes(0) ? [] : liveHits(path, bytes.toString("utf8"))
		})
		expect(hits).toEqual([])
	})

	it("leaves no honey token in a tracked path outside history", { timeout: SPAWN_TIMEOUT }, () => {
		const paths = tracked().filter((path) => spansOf(path, "x").some((span) => span.live))
		expect(paths.filter((path) => brandTokens(path, "honey").length > 0)).toEqual([])
	})

	it("finds a lesson glob that matches no file, and passes one that does", () => {
		const lesson = '---\npaths: ["src/a.ts","src/gone/**"]\n---\n'
		expect(danglingGlobs(lesson, ["src/a.ts", "src/b.ts"])).toEqual(["src/gone/**"])
	})

	it("points every lesson's paths at files that exist", { timeout: SPAWN_TIMEOUT }, () => {
		const files = tracked()
		const lessons = files.filter((path) => /^\.rulesync\/lessons\/[^/]+\.md$/.test(path))
		const dangling = lessons.flatMap((path) =>
			danglingGlobs(readFileSync(join(REPO, path), "utf8"), files).map((glob) => `${path}: ${glob}`),
		)
		expect(dangling).toEqual([])
	})
})
