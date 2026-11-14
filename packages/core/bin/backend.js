#!/usr/bin/env node
// The backend bin (bit 19 h2), clients' twin. A repository checkout (marked by tsconfig.json, which is not
// published) runs the TypeScript source, through jiti on Node, so a stale dist/ never runs; an installed package runs
// the compiled JavaScript on any runtime (the tarball ships dist/, not src/).
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const isBun = typeof globalThis.Bun !== "undefined"
const checkout = existsSync(new URL("../tsconfig.json", import.meta.url))

// `bun run` and `bunx` start this file through its node shebang, while what they run is meant for Bun: hand over to
// the Bun that started us, which they name in npm_execpath. Once, never again in the child.
function invokingBun() {
	if (isBun || process.env.BACKEND_NO_BUN_HANDOFF === "1") return null
	if (!process.env.npm_config_user_agent?.startsWith("bun/")) return null
	const bun = process.env.npm_execpath
	if (!bun || !/^bunx?(\.exe)?$/.test(basename(bun)) || !existsSync(bun)) return null
	return bun
}

// The handoff: Bun runs this file with our arguments and `env` over ours; a signal we get is passed on to it, and we
// end as it ended, its exit code or the same signal.
function handOff(bun, env = {}) {
	// Forwarders first: a signal landing as spawn returns would otherwise end this process by its default action,
	// orphaning the child. A handler runs from the event loop, after this block, so `child` is set by then.
	let child
	const forward = (signal) => child.kill(signal)
	for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, forward)
	child = spawn(bun, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
		env: { ...process.env, ...env, BACKEND_NO_BUN_HANDOFF: "1" },
		stdio: "inherit",
	})
	child.on("error", (error) => {
		console.error(`backend: could not start ${bun}: ${error.message}`)
		process.exit(1)
	})
	child.on("exit", (code, signal) => {
		if (signal) {
			for (const each of ["SIGINT", "SIGTERM", "SIGHUP"]) process.off(each, forward)
			process.kill(process.pid, signal)
			return
		}
		process.exit(code ?? 1)
	})
}

// A checkout's own subpath imports (`#output-check`) mapped to their `backend-source` file: jiti resolves a `#` import
// with Node's conditions, which send it to the dist/ a checkout does not build.
function importAliases() {
	const root = fileURLToPath(new URL("..", import.meta.url))
	const { imports = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
	return Object.fromEntries(
		Object.entries(imports).map(([name, target]) => [name, join(root, target["backend-source"])]),
	)
}

// A checkout on Bun runs its source natively, under the backend-source condition: an app's backend resolves to source
// then, not to the unbuilt dist/. Set through BUN_OPTIONS when the caller did not, so every
// generation child inherits it.
const SOURCE_CONDITION = "--conditions=backend-source"
const unconditioned = isBun && checkout && !process.execArgv.includes(SOURCE_CONDITION)
// The hand-off's backstop: its child carries BACKEND_BUN_HANDOFF, the depth of hand-offs before it. A child that would
// hand off again (the condition set but not in its execArgv) refuses instead of re-running itself without end.
const handOffDepth = Number(process.env.BACKEND_BUN_HANDOFF ?? 0)

async function entry() {
	if (checkout) {
		/* never jiti on Bun: its Babel, loaded on any fs-cache miss, hooks Error.prepareStackTrace, and Bun's own then
		 * throws "First argument must be an Error object" at a captureStackTrace on a non-Error (bit 20 k-fix) */
		if (isBun) return import("../src/build/cli.ts")
		const { createJiti } = await import("jiti")
		return createJiti(import.meta.url, { alias: importAliases(), tryNative: false }).import("../src/build/cli.ts")
	}
	try {
		return await import("../dist/build/cli.js")
	} catch (error) {
		if (error?.code === "ERR_MODULE_NOT_FOUND" && String(error.url).endsWith("/dist/build/cli.js")) {
			console.error("backend: dist/ is missing from this install. Reinstall it, or run it with Bun.")
			process.exit(1)
		}
		throw error
	}
}

const bun = invokingBun()
if (bun) handOff(bun)
else if (unconditioned && handOffDepth >= 1) {
	console.error("backend: Bun hand-off loop: --conditions=backend-source not visible after re-exec")
	process.exit(1)
} else if (unconditioned)
	handOff(process.execPath, {
		BUN_OPTIONS: `${process.env.BUN_OPTIONS ?? ""} ${SOURCE_CONDITION}`.trim(),
		BACKEND_BUN_HANDOFF: String(handOffDepth + 1),
	})
else {
	const { main } = await entry()
	const io = { err: (text) => process.stderr.write(text), out: (text) => process.stdout.write(text) }
	const code = await main(process.argv.slice(2), io)
	/* the app may leave a timer or a socket open: the run is over once main returns, its output flushed */
	for (const stream of [process.stdout, process.stderr]) await new Promise((done) => stream.write("", done))
	process.exit(code)
}
