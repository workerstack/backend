import { afterEach, describe, expect, it, vi } from "vitest"
import { canonicalIp, ipOf, PEER_ADDRESS, peerAddressOf } from "./peer.ts"

/** A request reporting `peer` the way `testClient`'s `ip` does. */
function fromPeer(peer: string | null, headers: Record<string, string> = {}): Request {
	const req = new Request("http://app.internal/who", { headers })
	Object.defineProperty(req, PEER_ADDRESS, { value: peer })
	return req
}

describe("canonicalIp: one spelling per address, however the platform wrote it", () => {
	// v0: 233e78e660
	// v0: 472258ccb7
	it.each([
		["203.0.113.7", "203.0.113.7"],
		["::ffff:203.0.113.7", "203.0.113.7"],
		["[::ffff:203.0.113.7]:80", "203.0.113.7"],
		["203.0.113.7:51234", "203.0.113.7"],
		["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
		["2001:db8:0:0:1:0:0:1", "2001:db8::1:0:0:1"],
		["2001:db8:0:1:1:1:1:1", "2001:db8:0:1:1:1:1:1"],
		["[2001:db8::1]:8443", "2001:db8::1"],
		["fe80::1%eth0", "fe80::1"],
		["64:ff9b::192.0.2.33", "64:ff9b::c000:221"],
		["::", "::"],
		["::1", "::1"],
		["1::", "1::"],
		[" 10.0.0.1 ", "10.0.0.1"],
	])("%j is %j", (text, canonical) => {
		expect(canonicalIp(text)).toBe(canonical)
	})

	it.each([
		"010.0.0.1",
		"256.0.0.1",
		"1.2.3",
		"0x7f.0.0.1",
		"1:2:3:4:5:6:7:8:9",
		"1::2::3",
		"1::g",
		"1:2:3:4::5:6:7:8",
		"12345::1",
		"1:2:3:4:5:6:7",
		"g::1",
		"::1.2.3",
		"[2001:db8::1",
		"[::1]x",
		"1.2.3.4:http",
		"1.2.3.4%eth0",
		"not-an-ip",
		"",
	])("%j is not one address: null, never a guess", (text) => {
		expect(canonicalIp(text)).toBeNull()
	})
})

describe("peerAddressOf: where the peer comes from", () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("reads the address set on the request in process, an empty one being none", () => {
		expect(peerAddressOf(fromPeer("203.0.113.7"))).toBe("203.0.113.7")
		expect(peerAddressOf(fromPeer(""))).toBeNull()
		expect(peerAddressOf(fromPeer(null))).toBeNull()
	})

	it("reads CF-Connecting-IP only on Workers, where the edge sets it and a client cannot", () => {
		const req = new Request("http://h/who", { headers: { "cf-connecting-ip": "198.51.100.4" } })
		expect(peerAddressOf(req)).toBeNull()
		vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" })
		expect(peerAddressOf(req)).toBe("198.51.100.4")
		expect(peerAddressOf(new Request("http://h/who"))).toBeNull()
	})
})

describe("ipOf: the request's ctx.ip, resolved once", () => {
	it("is the canonical peer, read once and kept on the request state", () => {
		const req = new Request("http://app.internal/who")
		let reads = 0
		Object.defineProperty(req, PEER_ADDRESS, {
			get: () => {
				reads++
				return "::ffff:203.0.113.7"
			},
		})
		const state: { ip?: string | null; req: Request } = { req }
		for (let i = 0; i < 3; i++) expect(ipOf(state)).toBe("203.0.113.7")
		expect([state.ip, reads]).toEqual(["203.0.113.7", 1])
	})

	it("is null when no runtime reports a peer, or reports one that is not an address", () => {
		expect(ipOf({ req: new Request("http://h/") })).toBeNull()
		expect(ipOf({ req: fromPeer("garbage") })).toBeNull()
	})
})
