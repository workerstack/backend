import { builtinModules } from "node:module"

/* 00-rules "Environments": portable core runs on Cloudflare Workers from one source, so Node
 * builtins and globals stay in build/ (build-time Node code) and the Workers adapter stays out of
 * portable files. */

const NODE_BUILTINS = new Set(builtinModules)

const RUNTIME_FILES = [
	["workers", /^(?:adapters\/workers\/|ws\/workers\.ts$)/],
	["build", /^build\//],
]

/* who may touch each runtime global; an empty list means nobody */
const GLOBALS = new Map([
	["Buffer", ["build"]],
	["Bun", []],
	["WebSocketPair", ["workers"]],
	["document", []],
	["process", ["build"]],
	["window", []],
])

const ADAPTER_BUCKETS = new Set(["workers"])

const MESSAGES = {
	adapter: "only the Workers adapter may import the Workers adapter",
	codegen: "core reaches honey-clients from build/ only",
	codegenStatic: "core imports honey-clients through import() only: it is an optional peer",
	escape: "an import stays inside its package's src (no repo path outside it, no sibling package)",
	node: "node builtins are for build-time code only",
	tsMorph: "ts-morph is honey-clients's dependency, not core's",
}

/** The src-relative path of a non-test file under core's src/, else null. */
function locate(filename) {
	const file = String(filename).replaceAll("\\", "/")
	if (/\.test\.[cm]?[jt]sx?$/.test(file)) return null
	const marker = "/packages/core/src/"
	const index = file.lastIndexOf(marker)
	return index === -1 ? null : file.slice(index + marker.length)
}

function bucketOf(rel) {
	for (const [bucket, pattern] of RUNTIME_FILES) if (pattern.test(rel)) return bucket
	return "portable"
}

/** The src-relative path `spec` points at from `rel`, or null when it climbs out of src. */
function resolveRel(rel, spec) {
	const parts = rel.split("/").slice(0, -1)
	for (const part of spec.split("/")) {
		if (part === "" || part === ".") continue
		if (part !== "..") parts.push(part)
		else if (parts.pop() === undefined) return null
	}
	return parts.join("/")
}

function isNodeBuiltin(spec) {
	return spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0])
}

/* no portable file reaches an adapter, statically or through import(): a server imports its runtime's entry.
 * An entry file (`*-subpath.ts`, re-exports only) is how a subpath offers the adapter beside the portable surface. */
function relativeProblem(where, spec) {
	const target = resolveRel(where.rel, spec)
	if (target === null) return "escape"
	const to = bucketOf(target)
	if (!ADAPTER_BUCKETS.has(to) || to === where.bucket) return null
	return where.rel.endsWith("-subpath.ts") ? null : "adapter"
}

function packageProblem(where, spec, dynamic) {
	if (spec === "ts-morph") return "tsMorph"
	if (spec.startsWith("@workerstack/clients")) {
		return where.bucket !== "build" ? "codegen" : dynamic ? null : "codegenStatic"
	}
	return null
}

function problemOf(where, spec, dynamic) {
	if (spec.startsWith(".")) return relativeProblem(where, spec)
	if (isNodeBuiltin(spec)) return where.bucket === "build" ? null : "node"
	return packageProblem(where, spec, dynamic)
}

export const rule = {
	create(context) {
		const rel = locate(context.filename)
		if (rel === null) return {}
		const where = { rel, bucket: bucketOf(rel) }
		const checkSource = (node) => {
			const spec = node.source?.type === "Literal" ? node.source.value : null
			if (typeof spec !== "string") return
			/* import() loads on demand and a type-only import is erased: neither loads with the module */
			const deferred = node.type === "ImportExpression" || node.importKind === "type" || node.exportKind === "type"
			const problem = problemOf(where, spec, deferred)
			if (problem !== null) context.report({ message: MESSAGES[problem], node })
		}
		const checkGlobal = (node, identifier) => {
			if (identifier?.type !== "Identifier") return
			const allowed = GLOBALS.get(identifier.name)
			if (allowed === undefined || allowed.includes(where.bucket)) return
			context.report({ message: `${identifier.name} is not available here (00-rules environments)`, node })
		}
		return {
			ExportAllDeclaration: checkSource,
			ExportNamedDeclaration: checkSource,
			ImportDeclaration: checkSource,
			ImportExpression: checkSource,
			MemberExpression: (node) => checkGlobal(node, node.object),
			NewExpression: (node) => checkGlobal(node, node.callee),
			UnaryExpression: (node) => node.operator === "typeof" && checkGlobal(node, node.argument),
		}
	},
}

export default {
	meta: { name: "honey" },
	rules: { boundaries: rule },
}
