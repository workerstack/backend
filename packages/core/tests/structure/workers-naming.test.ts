/**
 * The runtime is named for the product: `workers`, never the company. Platform facts keep their spelling, because
 * the platform spells them (`cf-connecting-ip`, the `Cloudflare-Workers` agent, `cloudflare:workers`).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const CORE = resolve(import.meta.dirname, "../..")
const read = (path: string) => readFileSync(resolve(CORE, path), "utf8")

describe("the workers runtime's public name", () => {
	it("no subpath names the company", () => {
		const { exports } = JSON.parse(read("package.json")) as { exports: Record<string, unknown> }
		expect(Object.keys(exports).filter((subpath) => /cloudflare|(^|\/)cf($|\/)/.test(subpath))).toEqual([])
	})

	it("./ws exports the Workers adapter beside the route", async () => {
		const { exports } = JSON.parse(read("package.json")) as { exports: Record<string, unknown> }
		expect(Object.keys(exports)).toContain("./ws")
		expect(Object.keys(exports)).not.toContain("./ws/workers")
		const surface = (await import("../../src/ws/ws-subpath.ts")) as Record<string, unknown>
		expect(typeof surface.workersWebSocket).toBe("function")
		expect(typeof surface.ws).toBe("function")
	})

	it("the adapter carries the name", () => {
		expect(read("src/ws/workers.ts")).toContain("export function workersWebSocket(")
	})

	it("the platform's own spellings stay", () => {
		expect(read("src/context/peer.ts")).toContain('"cf-connecting-ip"')
		expect(read("src/context/peer.ts")).toContain('"Cloudflare-Workers"')
	})
})
