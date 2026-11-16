/**
 * `ctx.res.sse` under a declared event stream: `send` takes each declared event by name with its schema's data, a bare
 * schema standing for the one `message` event, whose name may be left out. A declaration that holds no schema (`ok:
 * true`, or a generated plain type) keeps the untyped stream. Type-only.
 */
import type { ResponseOptions, StreamBody, TypedResponse } from "../response/response.ts";
import type { SseEventSchemas, SSEOptions, SSEStream } from "../response/sse.ts";
import type { InferInput, StandardSchemaLike } from "../validation/standard-schema.ts";

/** The id and retry any event may carry. */
type EventFields = {
  /** The id a reconnecting client sends back as `Last-Event-ID`. */
  id?: string;
  /** Reconnect delay in ms. */
  retry?: number;
};

/** The events a map declares: each name with its schema's data. */
type NamedEvent<S extends SseEventSchemas> = {
  [E in keyof S & string]: EventFields & {
    /** The event's payload, as its schema takes it: a string as is, anything else as JSON. */ data: InferInput<S[E]>;
    /** The declared event name. */ event: E;
  };
}[keyof S & string];

/** The `message` event a bare schema declares; its name may be left out. */
type MessageEvent<S extends StandardSchemaLike> = EventFields & {
  /** The event's payload, as its schema takes it: a string as is, anything else as JSON. */ data: InferInput<S>;
  /** `message`, the one event a bare schema declares; left out, it is `message` still. */ event?: "message";
};

/** The events `send` takes under an event stream's `ok` of `S`; `never` when it declares none. */
type DeclaredEvent<S> = S extends StandardSchemaLike
  ? MessageEvent<S>
  : S extends SseEventSchemas
    ? NamedEvent<S>
    : never;

/** An SSE stream whose `send` takes only `TEvent`. */
type TypedSSEStream<TEvent> = Omit<SSEStream, "send"> & {
  /** Queue a declared event; resolves when the client is ready for more, rejects once the stream ended. */
  send(event: TEvent): Promise<void>;
};

/** The stream an `sse()` callback gets under `ok` of `S`: typed by its events, untyped when it declares none. */
type StreamFor<S> = [DeclaredEvent<S>] extends [never] ? SSEStream : TypedSSEStream<DeclaredEvent<S>>;

/** `ctx.res.sse` for a route whose event stream declares `S` at `ok`. */
export type TypedSse<S> = (
  callback: StreamBody | ((stream: StreamFor<S>) => Promise<void>),
  opts?: ResponseOptions & SSEOptions,
) => TypedResponse<"text/event-stream", "ok">;
