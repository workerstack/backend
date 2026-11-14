# Cron

`@workerstack/backend/cron` defines scheduled jobs once. `@workerstack/backend/cron` runs them from a Workers cron
trigger.

## Example

```ts
import { defineCron } from "@workerstack/backend/cron"

type Env = { readonly DATABASE_URL: string }

declare function pruneSessions(url: string, signal: AbortSignal): Promise<number>

export const cron = defineCron<Env>({
	schedules: {
		"0 3 * * MON": {
			prune: async ({ env, log, signal }) => {
				log.info({ removed: await pruneSessions(env.DATABASE_URL, signal) }, "pruned")
			},
		},
	},
})
```

`defineCron<Env>({ schedules })` takes an optional `logger` beside the schedules, honey's logger by default. A job receives `env`, `log`, `schedule`, `scheduledAt` and `signal`. `scheduledAt` is the minute the run belongs to, not
the moment it started.

## Expressions

An expression is five fields in UTC: minute, hour, day of month, month, weekday. It takes `*`, lists, ranges, steps, and
month and weekday names. `defineCron` throws on anything else, naming the expression.

| refused                               | why                                                 | write instead                      |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| a numeric weekday, `0 9 * * 1`        | Workers numbers 1 as Sunday, POSIX numbers 0        | `0 9 * * MON`                      |
| both day fields, `0 0 1 * MON`        | POSIX runs on either, other schedulers only on both | one schedule per rule              |
| `L`, `W`, `#` and six fields          | only some schedulers take them                      | five fields and a check in the job |
| `*/0`, a reversed range, `0 0 30 2 *` | they can never fire as written                      | a date that occurs                 |

## On Workers

Export the handler from the entry your build points at. Honey's build moves a `scheduled` or `queue` function onto the Worker's default export,
where workerd calls it.

```ts
import { defineCron } from "@workerstack/backend/cron"
import { workersCron } from "@workerstack/backend/cron"

const cron = defineCron<{}>({ schedules: { "*/5 * * * *": { ping: async ({ log }) => log.info("ping") } } })

export const scheduled = workersCron(cron)
```

List the same expression, spelled the same way, under `triggers.crons` in your wrangler config. Workers reports the text
of the trigger that fired, and a run for an expression the definition lacks fails.

Every job of the expression runs. If one fails, the others finish, `noRetry()` is called so finished jobs do not run
again, and the run rethrows.
