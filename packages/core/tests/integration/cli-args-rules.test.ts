/**
 * The argument rules `honey` shares with `honey-clients generate` (bit 19 h1): each CLI parses its own flags (core needs
 * no codegen to run `honey init`, and gen never imports core, H2), so each package holds its parser to the same table,
 * a value flag standing as `<V>` and a boolean as `--watch`. The table is copied word for word in
 * @workerstack/clients's tests/integration/cli-args-rules.test.ts; change both together.
 */
import { describe, expect, it } from "vitest"
import { parseGenerateArgs } from "../../src/build/cli-args.ts"

const RULES: readonly (readonly [rule: string, argv: readonly string[], outcome: unknown])[] = [
	["a value after the flag", ["--<V>", "a.ts"], ["a.ts", false]],
	["a value inline, an = inside it kept", ["--<V>=a=b.ts"], ["a=b.ts", false]],
	["a value flag before another flag", ["--<V>", "--watch"], "--<V> requires a value"],
	["a value flag last", ["--watch", "--<V>"], "--<V> requires a value"],
	["an empty inline value", ["--<V>="], "--<V> requires a value"],
	["a bare boolean", ["--<V>", "a.ts", "--watch"], ["a.ts", true]],
	["a boolean set false", ["--<V>", "a.ts", "--watch=false"], ["a.ts", false]],
	["a boolean given another value", ["--<V>", "a.ts", "--watch=yes"], '--watch takes true or false, not "yes"'],
	["an unknown flag", ["--nope"], "unknown option --nope"],
	["a stray argument", ["a.ts"], 'unexpected argument "a.ts"'],
	["a bare --", ["--"], 'unexpected argument "--"'],
]

/** What a parse of `argv` (`<V>` as --app) gave: its error's message with the flag as `<V>`, else the app and watch. */
function outcome(argv: readonly string[]): unknown {
	try {
		const flags = parseGenerateArgs(argv.map((arg) => arg.replace("<V>", "app")))
		/* an unset flag is absent in core, gen's run defaults it */
		return [flags.app, flags.watch ?? false]
	} catch (err) {
		return (err as Error).message.replaceAll("--app", "--<V>")
	}
}

describe("honey reads its arguments by the rules honey-clients shares (bit 19 h1)", () => {
	it.each(RULES)("%s", (_rule, argv, expected) => {
		expect(outcome(argv)).toEqual(expected)
	})
})
