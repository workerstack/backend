/**
 * `@workerstack/backend/queue`: the queue surface in one entry, `queueContract` and `defineConsumer` for the
 * producer and consumer sides and `workersQueue` for the Worker's `queue` handler.
 */
export {
	deadLetter,
	defineConsumer,
	type QueueBatchEntry,
	QueueBodyError,
	type QueueConsumer,
	type QueueConsumerConfig,
	type QueueContext,
	type QueueContract,
	QueueDeadLetter,
	type QueueEntry,
	type QueueHandler,
	type QueueLetter,
	queueContract,
	queueMessage,
	type QueueMessageHandle,
	type QueueSchemas,
	type QueueDelayOptions,
	type QueueTarget,
} from "./define.ts"
export {
	type WorkersQueueBatch,
	type WorkersQueueContext,
	type WorkersQueueMessage,
	type WorkersQueueOptions,
	workersQueue,
} from "./workers.ts"
