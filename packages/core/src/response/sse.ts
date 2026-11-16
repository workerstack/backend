/**
 * The `text/event-stream` emitter behind `ctx.res.sse()`: event framing, the retry and id
 * directives, keepalive heartbeats, and the stream a callback writes events into.
 */
import { type ProducerOptions, type ProducerSink, producerStream } from "../streaming/producer-stream.ts";
import type { StandardSchemaLike } from "../validation/standard-schema.ts";

/** One server-sent event. */
export type SSEEvent = {
  /** The event's payload: a string as is, an object as JSON. */
  data: object | string;
  /** The event name the client listens for; `message` when left out. A newline in it makes `send()` throw. */
  event?: string;
  /**
   * The id a reconnecting client sends back as `Last-Event-ID`; `""` tells it to forget its last one. A newline in it
   * makes `send()` throw.
   */
  id?: string;
  /** Reconnect delay in ms; anything but a non-negative finite number is left out. */
  retry?: number;
};

/** Options for `ctx.res.sse()`. */
export type SSEOptions = {
  /** A `retry:` directive sent before any event. */
  defaultRetry?: number;
  /** Send a heartbeat comment every this many ms while the stream is open. */
  keepalive?: number;
  /** The id the client resumes from. Default: its `Last-Event-ID` header. */
  lastEventId?: string | undefined;
};

/** The stream an `sse()` callback writes events into. */
export type SSEStream = {
  /** End the stream. Idempotent and synchronous: safe in a `finally`. */
  close(): void;
  /** True once the stream ended: closed, or the client went away. */
  readonly closed: boolean;
  /**
   * The id the client resumes from: `lastEventId` from the options, else its `Last-Event-ID` header; `undefined` when
   * neither exists.
   */
  readonly lastEventId: string | undefined;
  /**
   * Queue an event. Resolves when the client is ready for more. After the stream ended it
   * rejects with an `AbortError`, which ends an awaiting loop; an unawaited one never surfaces
   * as an unhandled rejection.
   */
  send(event: SSEEvent): Promise<void>;
  /** Aborts when the client disconnects or the request ends. */
  readonly signal: AbortSignal;
};

// no `connection: keep-alive`: HTTP/1.1 keeps the connection anyway, the header would override a
// client's `Connection: close`, and HTTP/2 forbids it
export const SSE_HEADERS: Readonly<Record<string, string>> = /* @__PURE__ */ Object.freeze({
  "cache-control": "no-cache",
  "content-type": "text/event-stream",
});

/** The event a client hears when none is named, and the one a bare declared schema stands for. */
const MESSAGE = "message";

/**
 * A route's check of one event before it is sent: the refusal to log, `null` to send it, a promise only for an async
 * validator. `#output-check` compiles it from the declaration.
 */
export type SseCheck = (event: string, data: unknown) => string | null | Promise<string | null>;

/** Declared events by name, as `.output()` takes them under `text/event-stream`'s `ok`. */
export type SseEventSchemas = {
  /** An event's name, mapped to the schema its data must pass. */
  readonly [event: string]: StandardSchemaLike;
};

/**
 * The events a declared event stream's `ok` names: a bare schema is the one `message` event, a map names each;
 * `null` for `true` or nothing declared.
 */
export function declaredEvents(ok: unknown): SseEventSchemas | null {
  if (ok === null || typeof ok !== "object") return null;

  return "~standard" in ok ? { [MESSAGE]: ok as StandardSchemaLike } : (ok as SseEventSchemas);
}

/** What a declared event stream checks each event with, and where a refusal is told. */
export type SseEvents = {
  readonly check: SseCheck;
  /** Hears the refusal of an event that is not sent; the stream then ends. */
  readonly refuse: (message: string) => void;
};

const NEWLINE = /[\r\n]/;
const LINE_BREAK = /\r\n|\r|\n/;
const HEARTBEAT = ": heartbeat\n\n";

function swallow(): void {}

function isRetry(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * One event on the wire, named `message` when it names none. A newline in the name or the id would start another
 * field: it throws.
 */
export function encodeEvent(event: SSEEvent): string {
  const name = event.event ?? MESSAGE;

  if (NEWLINE.test(name)) throw new Error("SSE event name must not contain newlines");

  if (event.id !== undefined && NEWLINE.test(event.id)) throw new Error("SSE id must not contain newlines");
  const data = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
  let out = `event: ${name}\n`;

  for (const line of data.split(LINE_BREAK)) out += `data: ${line}\n`;

  if (event.id !== undefined) out += event.id === "" ? "id:\n" : `id: ${event.id}\n`;

  if (isRetry(event.retry)) out += `retry: ${Math.floor(event.retry)}\n`;

  return `${out}\n`;
}

/**
 * Heartbeats while the stream is open. At most one waits for the reader: a client that stopped
 * reading never has heartbeats piling up behind it.
 */
function keepAlive(sink: ProducerSink, every: number, encoder: TextEncoder): void {
  const heartbeat = encoder.encode(HEARTBEAT);
  let waiting = false;

  const timer = setInterval(() => {
    if (waiting) return;
    waiting = true;
    sink.write(heartbeat).then(() => {
      waiting = false;
    }, swallow);
  }, every);

  sink.onEnd(() => clearInterval(timer));
}

/**
 * `write` behind each event's check: a refused event is not written, `events.refuse` hears why, and the stream ends,
 * so this send and every later one reject as a send to an ended stream does.
 */
function checkedSend(
  sink: ProducerSink,
  events: SseEvents,
  write: (event: SSEEvent) => Promise<void>,
): (event: SSEEvent) => Promise<void> {
  const settle = (event: SSEEvent, refusal: string | null): Promise<void> => {
    if (refusal === null) return write(event);

    if (!sink.closed) {
      events.refuse(refusal);
      sink.close();
    }

    // the refused event is never encoded: the write only rejects, as any send to an ended stream does
    return sink.write(new Uint8Array(0));
  };

  // resolves once the last send whose check was pending has been written or refused; null when none is pending
  let turn: Promise<void> | null = null;

  return (event) => {
    if (sink.closed) return write(event);
    const verdict = events.check(event.event ?? MESSAGE, event.data);

    if (turn === null && !(verdict instanceof Promise)) return settle(event, verdict);
    // an earlier check is still pending, or this one is: wait for both, so events go out in the order sent
    const ready = Promise.all([turn, verdict]);
    const sent = ready.then(([, refusal]) => settle(event, refusal));
    const mine = ready.then(swallow, swallow);
    turn = mine;
    void mine.then(() => {
      if (turn === mine) turn = null;
    });

    return sent;
  };
}

/**
 * The body an SSE callback writes into; it ends when the callback settles, the client leaves, or the request ends.
 * With `events`, each event is checked before it is sent.
 */
export function sseBody(
  callback: (stream: SSEStream) => Promise<void>,
  options: SSEOptions,
  producer: ProducerOptions,
  events: SseEvents | null = null,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return producerStream((sink) => {
    const write = (event: SSEEvent) => sink.write(encoder.encode(encodeEvent(event)));

    const stream: SSEStream = {
      close: () => sink.close(),
      get closed() {
        return sink.closed;
      },
      lastEventId: options.lastEventId,
      send: events === null ? write : checkedSend(sink, events, write),
      signal: sink.signal,
    };

    if (isRetry(options.defaultRetry)) {
      // a failed write means the stream ended: the producer's own end reports it
      sink.write(encoder.encode(`retry: ${Math.floor(options.defaultRetry)}\n\n`)).catch(swallow);
    }

    if (options.keepalive !== undefined && options.keepalive > 0) keepAlive(sink, options.keepalive, encoder);

    return callback(stream);
  }, producer);
}
