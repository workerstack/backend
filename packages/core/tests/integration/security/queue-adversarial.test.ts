/**
 * The adversarial suite's queue cases, through the Workers consumer: a sender ahead of its consumer and a handler
 * settling twice. The platform bounds attempts (`max_retries`), so there is no attempt-limit case here. Each is a failing input first and the property that answers it
 * second; the mutation harness reruns this directory with each guard disabled.
 */
import { resolve as resolvePath } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { guardNamed } from "../../structure/mutation-harness.ts"

const REPO = resolvePath(import.meta.dirname, "../../../../..")

const mutant = guardNamed(process.env.BACKEND_MUTANT)
if (mutant !== undefined) {
	vi.doMock(resolvePath(REPO, mutant.module), async (importOriginal) => {
		const original = await importOriginal<Record<string, unknown>>()
		return { ...original, ...mutant.disable(original) }
	})
}

/* imported after the mock, so a mutant reaches every module that uses it */
const { workersQueue } = (await import(
	resolvePath(REPO, "packages/core/src/queue/workers.ts")
)) as typeof import("../../../src/queue/workers.ts")

const { defineConsumer, queueContract, queueMessage } = (await import(
	resolvePath(REPO, "packages/core/src/queue/define.ts")
)) as typeof import("../../../src/queue/define.ts")

const { SILENT } = (await import(
	resolvePath(REPO, "packages/core/src/telemetry/logger.ts")
)) as typeof import("../../../src/telemetry/logger.ts")

const jobs = queueContract({ job: queueMessage<number>() })

const message = (body: unknown) => {
	const calls: string[] = []
	return {
		ack: () => void calls.push("ack"),
		attempts: 1,
		body,
		calls,
		id: "m1",
		retry: () => void calls.push("retry"),
	}
}

const CTX = { waitUntil: () => {} }

describe("v1 adversarial: a sender ahead of its consumer", () => {
	it("never acks a type the consumer does not know, so the body survives", async () => {
		const consumer = defineConsumer<{}>()(jobs, { handlers: { job: () => {} }, logger: SILENT })
		const m = message({ data: 1, type: "added-next-deploy" })
		await workersQueue(consumer)({ messages: [m], queue: "q" }, {}, CTX)
		expect(m.calls).toEqual(["retry"])
	})
})

describe("v1 adversarial: a handler settling twice", () => {
	it("lets only the first settle reach the platform", async () => {
		const consumer = defineConsumer<{}>()(jobs, {
			handlers: {
				job: ({ message: own }) => {
					own.ack()
					own.retry()
				},
			},
			logger: SILENT,
		})
		const m = message({ data: 1, type: "job" })
		await workersQueue(consumer)({ messages: [m], queue: "q" }, {}, CTX)
		expect(m.calls).toEqual(["ack"])
	})
})
