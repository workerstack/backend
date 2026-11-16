import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { HttpError } from "../errors/error.ts";
import { WSContextImpl } from "../ws/contract.ts";
import type { WsMessages } from "../ws/messages.ts";
import { type ConnContext, type RealtimeOptions, resolveRealtimeConfig } from "./route.ts";
import { createRealtimeSession } from "./server.ts";

const Say = z.object({ text: z.string(), type: z.literal("say") });
const issue = "text: Invalid input: expected string, received undefined";

/** Every task the session's lane holds has run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

/** One open session over a socket whose sends and closes land in `events`. */
function open(messages: WsMessages, options: Partial<RealtimeOptions<unknown, never, WsMessages>> = {}) {
  const events: unknown[] = [];
  const config = resolveRealtimeConfig("/rt", { handler: () => {}, messages, ...options } as RealtimeOptions);
  const log = { error: vi.fn<(fields: Record<string, unknown>, msg?: string) => void>() };
  const session = createRealtimeSession({ config, ctx: {}, log, userId: null });

  const ws = new WSContextImpl({
    close: (code, reason) => void events.push(["close", code, reason]),
    readyState: 1,
    send: (data) => void events.push(["send", data]),
  });

  session.attach(ws);

  return { events, log, session };
}

/** A handler that records each message it hears into `events`. */
const hearing = (events: unknown[]) => (_ctx: unknown, conn: ConnContext) =>
  conn.on("message", (msg) => void events.push(["message", msg]));

describe("a realtime route that declares what it receives", () => {
  it("hands conn.on the schema's value; a refused frame calls onError with invalid_message, closes 1007, and no later frame runs", async () => {
    const heard: unknown[] = [];

    const { events, session } = open(
      { receive: Say.refine(async () => true) },
      {
        handler: hearing(heard),
        onError: (error) => {
          const e = error as HttpError;
          heard.push(["error", e instanceof HttpError, e.errorKey, e.status, e.vars]);
        },
      },
    );

    session.message('{"type":"say","text":"hi"}');
    session.message('{"type":"say"}');
    session.message('{"type":"say","text":"late"}');
    await vi.waitFor(() => expect(events).toHaveLength(1));
    await flush();
    expect([heard, events]).toEqual([
      [
        ["message", { text: "hi", type: "say" }],
        ["error", true, "invalid_message", 400, { issue }],
      ],
      [["close", 1007, `invalid message: ${issue}`]],
    ]);
  });

  it("closes 1007 on a binary or non-JSON frame, and cuts a long issue to 123 UTF-8 bytes", async () => {
    // a check runs at a frame's turn, once a message handler exists
    const listening = { handler: hearing([]) };
    const binary = open({ receive: Say }, listening);
    const text = open({ receive: Say }, listening);
    const long = open({ receive: z.string().min(1, "é".repeat(100)) }, listening);
    binary.session.message(new ArrayBuffer(2));
    text.session.message("not json");
    long.session.message('""');
    await flush();
    const [[, code, reason]] = long.events as [[string, number, string]];
    expect([binary.events, text.events, code, new TextEncoder().encode(reason).length <= 123]).toEqual([
      [["close", 1007, "invalid message: expected a JSON text frame"]],
      [["close", 1007, "invalid message: expected a JSON text frame"]],
      1007,
      true,
    ]);
  });
});

describe("a realtime route that declares what it receives: onError and order", () => {
  it("lets onError answer the client before the 1007 close, or close the connection itself", async () => {
    const answering = open(
      { receive: Say },
      { handler: hearing([]), onError: (_error, conn) => conn.send({ error: "invalid_message" }) },
    );

    const closing = open({ receive: Say }, { handler: hearing([]), onError: (_error, conn) => conn.close("bye") });
    answering.session.message("{}");
    closing.session.message("{}");
    await flush();
    expect([answering.events, closing.events]).toEqual([
      [
        ["send", '{"error":"invalid_message"}'],
        ["close", 1007, "invalid message: text: Invalid input: expected string, received undefined"],
      ],
      [["close", 1000, "bye"]],
    ]);
  });

  it("keeps frame order when a frame's check is async; an untyped route still ignores binary and non-JSON", async () => {
    const heard: unknown[] = [];

    const slowFirst = Say.refine((said) =>
      said.text === "1" ? new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 5)) : true,
    );

    const typed = open({ receive: slowFirst }, { handler: hearing(heard) });
    typed.session.message('{"type":"say","text":"1"}');
    typed.session.message('{"type":"say","text":"2"}');
    const plainHeard: unknown[] = [];
    const plain = open({}, { handler: hearing(plainHeard) });
    plain.session.message(new ArrayBuffer(2));
    plain.session.message("not json");
    plain.session.message('{"any":1}');
    await vi.waitFor(() => expect(heard).toHaveLength(2));
    await flush();
    expect([(heard as [string, { text: string }][]).map(([, msg]) => msg.text), plainHeard, plain.events]).toEqual([
      ["1", "2"],
      [["message", { any: 1 }]],
      [],
    ]);
  });
});

const Said = z.object({ text: z.string(), type: z.literal("said") });

// every check async, the first one late: only a shared ordered lane keeps the first message first
const SlowFirst = z.string().refine(async (s) => {
  if (s === "1") await new Promise((resolve) => setTimeout(resolve, 5));

  return true;
});

describe("a realtime route that declares what it sends", () => {
  it("sends and publishes what the schema takes; a refused one is not sent, is logged, closes 1011, and nothing later goes out", async () => {
    const { events, log } = open(
      { send: Said },
      {
        handler: (_ctx, conn) => {
          conn.join("room");
          conn.send({ text: "hi", type: "said" });
          conn.publish("room", { text: "all", type: "said" });
          conn.send({ text: 1, type: "said" } as never);
          conn.publish("room", { text: "late", type: "said" });
        },
      },
    );

    await flush();
    expect([events, log.error.mock.calls]).toEqual([
      [
        ["send", '{"text":"hi","type":"said"}'],
        ["send", '{"text":"all","type":"said"}'],
        ["close", 1011, "invalid outgoing message"],
      ],
      [
        [
          expect.objectContaining({ phase: "realtime send", route: "/rt" }),
          "realtime send: invalid message: text: Invalid input: expected string, received number",
        ],
      ],
    ]);
  });
});

describe("a realtime route that declares what it sends: order and failures", () => {
  it("keeps order across send and publish when the check is async, and refuses a checked message that is no JSON", async () => {
    const ordered = open(
      { send: SlowFirst },
      {
        handler: (_ctx, conn) => {
          conn.join("room");
          conn.send("1");
          conn.publish("room", "2");
        },
      },
    );

    const bigint = open(
      { send: z.unknown().refine(async () => true) },
      {
        handler: (_ctx, conn) => {
          conn.send({ n: 1n });
          conn.send("after");
        },
      },
    );

    await vi.waitFor(() => expect(ordered.events).toHaveLength(2));
    await vi.waitFor(() => expect(bigint.events).toHaveLength(1));
    await flush();
    expect([ordered.events, bigint.events, bigint.log.error.mock.calls[0]?.[1]]).toEqual([
      [
        ["send", '"1"'],
        ["send", '"2"'],
      ],
      [["close", 1011, "invalid outgoing message"]],
      expect.stringMatching(/^realtime send: invalid message: send failed: /),
    ]);
  });
});

describe("a realtime route that declares what it sends: after close", () => {
  it("logs a refused publish from a close handler, and closes nothing twice", async () => {
    const { events, log, session } = open(
      { send: Said },
      { handler: (_ctx, conn) => conn.on("close", () => conn.publish("room", { type: "said" } as never)) },
    );

    session.close("gone");
    await flush();
    expect([events, log.error.mock.calls.map(([, message]) => message)]).toEqual([
      [],
      ["realtime send: invalid message: text: Invalid input: expected string, received undefined"],
    ]);
  });
});
