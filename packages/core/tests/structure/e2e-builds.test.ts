/**
 * The e2e build tier's time gate (tests/e2e/build-gate.ts, bit 21 cfb), judged as a pure function on injected timings:
 * a cell's build time over a honey-free reference build's, against a ceiling CI records, and an absolute hang guard.
 * Each regression below reds the ratio on CI's fast runner class and on its slow one, which an absolute ceiling
 * cannot both do; the hang guard reds a runaway build in every mode. The ceilings themselves are pending CI's record
 * runs, and are owed before bit 21 closes.
 */
import { describe, expect, it } from "vitest"
import * as gate from "../e2e/build-gate.ts"
import { ceilingRule, chiSquareQuantile, normalQuantile, WORST_MARGIN } from "../e2e/ceiling-rule.ts"
import { BUILD_SPECS } from "../e2e/builds.ts"
import { COMPLETE } from "./check-tree.ts"
import KNOWN_REDS from "./fixtures/known-perf-reds.json" with { type: "json" }

/*
 * surface×workers on bun 1.3.11 on this machine, under the heavy lock (bit 21 cfb, cfb-cause.md): its honey
 * generate child 1286 ms and its bundle 135 ms (medians of 9), the honey-free reference 96 ms (median of 30)
 */
const LOCAL = { bundle: 135, generate: 1286, reference: 96 }
/* CI's runner classes over this machine: 2.7 s and 5.5 s against 1.42 s here (cfb-cause.md) */
const PROFILES = { fast: 1.9, slow: 3.9 } as const
/* the build's own spread here, slowest over median (1.16, its cold first build): record runs carry that noise */
const SPREADS = [1, 1.02, 1.16] as const

const KEY = "node 22"
const CELL = "surface×workers"

/** One record-mode job on a runner `factor` times this machine, its app build `spread` over its median. */
function recordJob(
	run: number,
	factor: number,
	spread: number,
): { job: string; ratios: gate.RatioRecord[]; run: string } {
	const ms = (LOCAL.generate + LOCAL.bundle) * spread * factor
	const referenceMs = LOCAL.reference * factor
	const ratio = Number((ms / referenceMs).toFixed(2))
	return { job: "build (node)", ratios: [{ cell: CELL, key: KEY, ms, ratio, referenceMs }], run: String(run) }
}

/* six record runs, three per runner class, each with the measured spread: what a calibration dispatch yields */
const RECORDED = gate.deriveCeilings([
	...SPREADS.map((spread, i) => recordJob(i, PROFILES.fast, spread)),
	...SPREADS.map((spread, i) => recordJob(i + 3, PROFILES.slow, spread)),
])
const CEILING = RECORDED[KEY]?.[CELL]

/** What the hang guard says of a build of `ms` on node in `mode`, no ceiling recorded. */
const at = (ms: number, mode: "judge" | "record") =>
	gate.judgeBuild({ builds: [ms, ms, ms], ceiling: undefined, mode, referenceMs: 100, runtime: "node" }).failures

/** The verdict on a build of `ms` here, against a reference of `referenceMs` here, on a runner `factor` slower. */
const judge = (ms: number, referenceMs: number, factor: number, mode: "judge" | "record" = "judge") =>
	gate.judgeBuild({
		builds: [ms * factor, ms * factor, ms * factor],
		ceiling: CEILING,
		mode,
		referenceMs: referenceMs * factor,
		runtime: "node",
	})

describe("the e2e build gate's ratio", () => {
	it("derives one ceiling from runs on both runner classes under the 2% rule", () => {
		/* one cell carries the whole 2% budget: the worst, 17.17, x 1.35 is 23.18, over its log-normal tail, 20.322 */
		expect(CEILING).toEqual({ baseline: 15.1, catches: "+54%", ceiling: 23.18 })
	})

	it("passes the unchanged build on either runner class, the 1.16x cold build included", () => {
		const statuses = Object.values(PROFILES).flatMap((factor) =>
			SPREADS.map((spread) => judge((LOCAL.generate + LOCAL.bundle) * spread, LOCAL.reference, factor).status),
		)
		expect(statuses).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"])
	})

	/* 1.5x slower reads 21.5, under the 23.18 ceiling: the cost of a margin that holds a runner-class swing (plan 37) */
	it("reds honey generate made 1.75x slower, on the fast runner class and on the slow one", () => {
		const slower = LOCAL.generate * 1.75 + LOCAL.bundle
		const regressed = "build ratio 24.85 over its 23.18 ceiling (CI median 15.1)"
		expect(Object.values(PROFILES).map((factor) => judge(slower, LOCAL.reference, factor))).toEqual([
			{ failures: [regressed], hung: false, ratio: 24.85, status: "REGRESSED" },
			{ failures: [regressed], hung: false, ratio: 24.85, status: "REGRESSED" },
		])
	})

	it("reds a regression slowing every honey app alike, which an app-over-sibling-app ratio passes", () => {
		/* CI's cf-workers prod job on a fast runner, run 40734198419: surface built in 2.7 s, defaults in 2.4 s */
		const sibling = { defaults: 2_400, surface: 2_700 }
		const added = LOCAL.generate * 0.75 * PROFILES.fast /* +75% of generation's time, in every app's build alike */
		const local = (ms: number) => ms / PROFILES.fast
		const verdict = judge(local(sibling.surface + added), LOCAL.reference, PROFILES.fast)
		expect({
			honeyFree: verdict.status,
			siblingAfter: Number(((sibling.surface + added) / (sibling.defaults + added)).toFixed(2)),
			siblingBefore: Number((sibling.surface / sibling.defaults).toFixed(2)),
		}).toEqual({ honeyFree: "REGRESSED", siblingAfter: 1.07, siblingBefore: 1.13 })
	})

	it("never judges in record mode or with no recorded ceiling: report-only until CI records one", () => {
		const slower = LOCAL.generate * 1.5 + LOCAL.bundle
		const unbaselined = gate.judgeBuild({
			builds: [slower, slower, slower],
			ceiling: undefined,
			mode: "judge",
			referenceMs: LOCAL.reference,
			runtime: "node",
		})
		expect([judge(slower, LOCAL.reference, 1, "record"), unbaselined]).toEqual([
			{ failures: [], hung: false, ratio: 21.5, status: "recorded" },
			{ failures: [], hung: false, ratio: 21.5, status: "unbaselined" },
		])
	})
})

/*
 * The ceiling rule's reference values, from its stdlib Python form (bit 21 bref ceiling_rule.py): chi-square's lower
 * 10% quantiles at 5, 11 and 23 degrees of freedom, and z at 2% over 42 cells and over one.
 */
const CHI2_LOW = [1.6103, 5.5778, 14.848] as const
const Z = { 1: 2.05375, 42: 3.30423 } as const

describe("the e2e build gate's ceiling rule", () => {
	it("reads chi-square and normal quantiles to their tables", () => {
		const chi2 = [5, 11, 23].map((df) => Number(chiSquareQuantile(0.1, df).toFixed(4)))
		const z = [1, 42].map((cells) => Number(normalQuantile(1 - 0.02 / cells).toFixed(5)))
		expect({ chi2, z }).toEqual({ chi2: [...CHI2_LOW], z: [Z[1], Z[42]] })
	})

	it("takes a spread cell's log-normal tail at 2% over the cells, which the worst x 1.35 sits under", () => {
		/* CI's Node 22 cells move between runner classes, about 1.8 and 2.35: worst x 1.35 is 3.24 */
		const bimodal = [1.8, 1.85, 1.82, 2.3, 2.35, 2.4, 1.79, 2.1]
		expect(Number(ceilingRule(bimodal, 42).toFixed(3))).toBe(3.985)
	})

	it("keeps the worst x 1.35 for a tight cell, whose tail sits under it", () => {
		const tight = [...Array.from({ length: 11 }, () => 2), 2.02]
		expect([WORST_MARGIN, Number(ceilingRule(tight, 42).toFixed(3))]).toEqual([1.35, 2.727])
	})

	/* the three judged reds on unchanged code, each over the ceiling its own pool gave under the old 1.10 floor */
	it("holds each known runner-class red under the ceiling its pool now gives", () => {
		const reds = KNOWN_REDS.map(({ pool, red }) => red < ceilingRule(pool, 1))
		expect(reds).toEqual(KNOWN_REDS.map(() => true))
	})
})

describe("the e2e build gate's hang guard", () => {
	it("reds a build over node's guard in judge and record mode alike", () => {
		expect([at(13_001, "judge"), at(13_001, "record"), at(13_000, "judge")]).toEqual([
			["built in 13001ms, over the 13000ms hang guard on node"],
			["built in 13001ms, over the 13000ms hang guard on node"],
			[],
		])
	})

	it("is the worst local median x the slow class's 3.9 x its spread, above CI's slowest cell", () => {
		/* Node 2.47 s x 3.9 x 1.28 = 12.3 s; CI's slowest Node cell: 8.2 s */
		const derived = { node: Math.ceil(2.47 * 3.9 * 1.28) * 1_000 }
		expect([gate.HANG_GUARD_MS, gate.HANG_GUARD_MS.node > 8_200]).toEqual([derived, true])
	})
})

describe("the e2e build gate's record lines", () => {
	it("keys a ceiling by Node's major", () => {
		expect([gate.runtimeKey("node", "v22.23.3"), gate.runtimeKey("node", "v26.12.1")]).toEqual(["node 22", "node 26"])
	})

	it("parses its RATIO lines back out of a CI log, the job and timestamp columns before them", () => {
		const log = [
			`e2e (cf-workers prod)\tRun bun run test:e2e:cf:prod\t2026-10-28T19:30:45.9Z ${gate.ratioLine(KEY, CELL, 15.04, [5_512.4, 5_498, 5_620], 366.6)}`,
			gate.referenceLine(KEY, CELL, [366.6, 360, 371, 368]),
			"RATIO build node@22 defaults×workers 17.84 ms=2480 ref=139" /* a k=1 record run's line, before builds= */,
			"RATIO hotpath body 1.2",
		].join("\n")
		expect([
			gate.parseRatios(log),
			log
				.split("\n")
				.slice(0, 2)
				.map((line) => line.replace(/^.*Z /, "")),
		]).toEqual([
			[
				{ builds: [5_512, 5_498, 5_620], cell: CELL, key: KEY, ms: 5_512, ratio: 15.04, referenceMs: 367 },
				{ cell: "defaults×workers", key: KEY, ms: 2_480, ratio: 17.84, referenceMs: 139 },
			],
			[
				"RATIO build node@22 surface×workers 15.04 ms=5512 ref=367 builds=5512,5498,5620",
				"REFERENCE build node@22 surface×workers 367 367,360,371,368",
			],
		])
	})

	it("refuses a derive from fewer than 6 runs", () => {
		const runs = [0, 1, 2, 3, 4, 5].map((run) => recordJob(run, PROFILES.fast, 1))
		expect(() => gate.deriveCeilings(runs.slice(0, 5))).toThrow("a derive needs 6+ record runs; got 5 runs")
		expect(gate.deriveCeilings(runs)[KEY]?.[CELL]).toBeDefined()
	})
})

describe("the e2e build gate's ceilings", () => {
	const keys = ["node 22"] /* the build job's runtime: setup-node's "22" */
	const cells = BUILD_SPECS.map((spec) => spec.id)

	it("names every cell a baseline lacks, so a pending one cannot pass for recorded", () => {
		const one = { builds: { [KEY]: { [CELL]: CEILING as gate.BuildCeiling } }, note: "", runs: [] }
		expect([
			gate.missingCeilings(undefined, [KEY], [CELL]),
			gate.missingCeilings(one, [KEY], [CELL, "mcp×workers"]),
		]).toEqual([[`${KEY} ${CELL}`], [`${KEY} mcp×workers`]])
	})

	it(`are recorded from CI for every cell before bit 21 closes (COMPLETE is ${COMPLETE})`, () => {
		const owed = COMPLETE >= 21 ? gate.missingCeilings(gate.readBaseline(), keys, cells) : []
		expect(owed).toEqual([])
	})
})

/*
 * Record runs across two code versions (the by-commit derive): six runs at an older commit, six at the newest, each a
 * build (node) job. surface×workers carries the same ratios' spread on both; mcp×workers moved from ~3.4 to ~4.65 (a
 * changed app), so its groups' ranges do not overlap.
 */
type Version = { commit: string; created: string }
/** Six runs at one commit: each cell's ratio, run by run. */
type CommitRuns = { mcp: readonly number[]; surface: readonly number[] }

const OLD: Version = { commit: "7731b1f", created: "2026-10-29T08:00:00Z" }
const NEW: Version = { commit: "b2946ee", created: "2026-10-29T12:00:00Z" }
const RUNS: Record<"new" | "old", CommitRuns> = {
	new: { mcp: [4.6, 4.7, 4.5, 4.8, 4.6, 4.7], surface: [15.1, 15.2, 14.95, 15.0, 15.25, 15.05] },
	old: { mcp: [3.4, 3.3, 3.5, 3.4, 3.3, 3.4], surface: [15.0, 14.9, 15.2, 15.3, 15.1, 15.0] },
}

/** One run's build (node) job at `version`, its cells at `ratios`. */
function commitRun(version: Version, run: string, ratios: { mcp: number; surface: number }) {
	const cell = (name: string, ratio: number) => ({ cell: name, key: KEY, ms: 2_100, ratio, referenceMs: 2_100 / ratio })
	return { ...version, job: "build (node)", ratios: [cell(CELL, ratios.surface), cell("mcp×workers", ratios.mcp)], run }
}

/** Every job of the runs at `version`, numbered from `from`. */
const commitRuns = (version: Version, from: number, runs: CommitRuns) =>
	runs.surface.map((surface, i) => commitRun(version, String(from + i), { mcp: runs.mcp[i] as number, surface }))

describe("the e2e build gate's derive across commits", () => {
	const decided = gate.deriveByCommit([...commitRuns(OLD, 1, RUNS.old), ...commitRuns(NEW, 7, RUNS.new)])
	const row = (cell: string) => decided.find((each) => each.cell === cell)

	it("pools a cell whose commit groups agree within each other's range: its n is both groups'", () => {
		expect([row(CELL)?.decision, row(CELL)?.n]).toEqual(["pooled", 12])
		expect(row(CELL)?.ceiling).toEqual({ baseline: 15.07, catches: "+37%", ceiling: 20.655 })
	})

	it("derives a shifted cell from the newest commit's runs alone", () => {
		expect(row("mcp×workers")).toEqual({
			cell: "mcp×workers",
			ceiling: { baseline: 4.65, catches: "+39%", ceiling: 6.48 },
			decision: "new-only",
			groups: [
				{ commit: OLD.commit, n: 6 },
				{ commit: NEW.commit, n: 6 },
			],
			key: KEY,
			n: 6,
		})
	})

	it("refuses a shifted cell whose newest commit has under 6 runs, by name, and still pools an agreeing one", () => {
		const fewer = gate.deriveByCommit([...commitRuns(OLD, 1, RUNS.old), ...commitRuns(NEW, 7, RUNS.new).slice(0, 4)])
		const of = (cell: string) => fewer.find((each) => each.cell === cell)
		expect([of("mcp×workers")?.refused, of("mcp×workers")?.ceiling, of(CELL)?.decision, of(CELL)?.refused]).toEqual([
			`${KEY} mcp×workers: new-only from ${NEW.commit}: 4 runs, fewer than 6`,
			undefined,
			"pooled",
			undefined,
		])
	})
})
