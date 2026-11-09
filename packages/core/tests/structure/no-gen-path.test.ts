/**
 * core stands alone (roadmap 5 slice 4): no file of this package reaches packages/gen by path, so the package works
 * the same once gen is its own repo (github.com/workerstack/clients) and arrives from npm. clients is reached by its
 * package name, `@workerstack/clients`, and its published exports only.
 *
 * Repo tooling that spans both packages until the split is left out, and slices 5 and 6 divide it: the lint plugin,
 * the structure and docs suites, and the pack and release legs.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { SPAWN_TIMEOUT } from "../fixture/spawn-timeout.ts"

const CORE = resolve(import.meta.dirname, "../..")
const TOOLING_TREES = ["lint/", "tests/structure/", "tests/docs/"]
const TOOLING_FILES = [
	"tests/build/fixture/packed.ts",
	"tests/build/packaging.test.ts",
	"tests/build/changelog.test.ts",
	"tests/build/conformance-gate.test.ts",
	"tests/build/prerelease.test.ts",
	"tests/build/provenance.test.ts",
	"tests/e2e/run-strict-consumer.ts",
]
/* `packages/gen`, or a relative step into the sibling: `../gen`, `../../gen/src`, `resolve(CORE, "../gen")` */
const CROSSING = /packages\/gen\b|\.\.\/gen\b/

/** Every file under core that git tracks or would add, package-relative, but the repo tooling. */
function files(): string[] {
	const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "."], {
		cwd: CORE,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	})
	return out
		.split("\0")
		.filter((file) => file !== "" && !TOOLING_FILES.includes(file) && !TOOLING_TREES.some((t) => file.startsWith(t)))
}

/** `<file>:<line> reaches packages/gen by path: …` for each crossing in `file`. */
function crossings(file: string): string[] {
	const path = join(CORE, file)
	if (!existsSync(path)) return []
	const bytes = readFileSync(path)
	if (bytes.includes(0)) return []
	return bytes
		.toString("utf8")
		.split("\n")
		.flatMap((line, i) =>
			CROSSING.test(line) ? [`${file}:${i + 1} reaches packages/gen by path: import @workerstack/clients by name`] : [],
		)
}

describe("core reaches clients by package name only (roadmap 5 slice 4)", () => {
	it(
		"no file under packages/core outside the repo tooling names packages/gen or steps into ../gen",
		{ timeout: SPAWN_TIMEOUT },
		() => {
			expect(files().flatMap(crossings)).toEqual([])
		},
	)

	it("every repo-tooling exemption exists", () => {
		expect(TOOLING_FILES.filter((file) => !existsSync(join(CORE, file)))).toEqual([])
	})
})
