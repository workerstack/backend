# dx — cron

One schedule definition for Workers and for a Node or Bun process. Five fields in UTC, in the subset every runtime reads the same way.

| value | required | default | outcome | pitfall | test |
| --- | --- | --- | --- | --- | --- |
| `defineCron<Env>({ schedules })` | `schedules` | — | a checked definition; throws naming the expression | — | `cron/workers.test.ts` |
| `logger` | — | honey's logger | where jobs log, bound to job and schedule | — | `cron/workers.test.ts` |
| an expression | — | — | `*`, lists, ranges, steps, month and weekday names | numeric weekdays, both day fields, `L`, `W`, `#`, six fields, `*/0`, reversed ranges and dates that never occur throw | `cron/expression.test.ts` |
| `workersCron(cron)` | — | — | the `scheduled` handler; every job runs, `noRetry()` before a failed run rethrows | the expression must match the trigger's text; an unknown one fails the run | `cron/workers.test.ts` |
| `scheduled`, `queue` on a Worker's entry | — | — | a function moves onto the default export, where workerd calls it | its name stays as an inert object, since an export list is static | `build/targets.test.ts` |
