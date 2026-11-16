import { describe, expect, test } from "bun:test";

import type { WSAdapter } from "@workerstack/backend/http";

import { compareApps, probesFromTree } from "../../../differential.ts";
import { routeTree } from "../src/_gen/routes.gen.ts";
import { createApp } from "../src/app.ts";
import { greetingLog } from "../src/app2.ts";

const stubWs: WSAdapter = {
  upgrade() {
    return {
      response: new Response("websocket upgrade not used in smoke", { status: 426 }),
      socket: {
        close() {},
        raw: { close() {}, readyState: 3, send() {} },
        get readyState() {
          return 3 as const;
        },
        send() {},
      },
    };
  },
};

const app = createApp(stubWs);

async function fetchApp(path: string, init?: RequestInit): Promise<Response> {
  return app.fetch(new Request(`http://backend.test${path}`, init), {});
}

describe("e2e kitchen consumes backend", () => {
  test("GET /api/health", async () => {
    const res = await fetchApp("/api/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  test("GET /api/echo echoes method", async () => {
    const res = await fetchApp("/api/echo");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ method: "GET" });
  });

  test("GET /api/v1/organizations without auth is rejected", async () => {
    const res = await fetchApp("/api/v1/organizations");
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as { error_key?: string };
    expect(body.error_key).toBeDefined();
  });

  test("CORS preflight echoes origin", async () => {
    const res = await fetchApp("/api/echo", {
      headers: {
        "access-control-request-method": "POST",
        origin: "http://localhost:3000",
      },
      method: "OPTIONS",
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});

describe("serves identically from its generated route tree", () => {
  test("boots with .routeTree() and answers every probe like the runtime trie", async () => {
    const probes = probesFromTree(routeTree, (p) => p);
    expect(probes.length).toBeGreaterThan(5);
    expect(await compareApps(createApp(stubWs), createApp(stubWs, { routeTree }), probes)).toEqual([]);
  });
});

describe("its SSE routes in the generated document (carry-in #7)", () => {
  test("GET /api/events and /api/events-live each document a 2xx text/event-stream answer", async () => {
    const doc = (await Bun.file(new URL("../src/_gen/openapi.gen.json", import.meta.url)).json()) as {
      paths: Record<string, { get: { responses: Record<string, { content?: Record<string, unknown> }> } }>;
    };

    const streams = (path: string) =>
      Object.entries(doc.paths[path]?.get.responses ?? {})
        .filter(([status, answer]) => status.startsWith("2") && answer.content?.["text/event-stream"] !== undefined)
        .map(([status]) => status);

    expect([streams("/api/events"), streams("/api/events-live")]).toEqual([["200"], ["200"]]);
  });
});

describe("its hello groups share one step typed OperationCtx over both ids", () => {
  test("GET /api/hello greets through the step and its c.with db", async () => {
    const res = await fetchApp("/api/hello?q=ada");
    expect([res.status, await res.json()]).toEqual([200, { greeting: "hello ada (audited)", q: "ada" }]);
  });

  test("POST /api/hello greets through the same step, by the greeter, and fires the defined tap", async () => {
    const res = await fetchApp("/api/hello", {
      body: JSON.stringify({ name: "ada" }),
      headers: { "content-type": "application/json", "x-greeter": "bob" },
      method: "POST",
    });

    expect([res.status, await res.json()]).toEqual([
      200,
      { by: "bob", created: "ada", greeting: "hello ada (audited)" },
    ]);
    expect(greetingLog.at(-1)).toBe("ada");
  });

  test("the step's shared c.errors refuses a name in either group, and a POST without a greeter", async () => {
    const refused = async (res: Response) => [res.status, ((await res.json()) as { error_key: string }).error_key];

    const post = (headers: Record<string, string>, name: string) =>
      fetchApp("/api/hello", {
        body: JSON.stringify({ name }),
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      });

    expect([
      await refused(await fetchApp("/api/hello?q=nobody")),
      await refused(await post({ "x-greeter": "bob" }, "nobody")),
      await refused(await post({}, "ada")),
    ]).toEqual([
      [403, "greeting_refused"],
      [403, "greeting_refused"],
      [403, "greeting_refused"],
    ]);
  });

  test("POST /api/hello's invalidate names hello.list, emitted as its METHOD and pattern", async () => {
    const doc = (await (await fetchApp("/api/openapi.json")).json()) as {
      paths: Record<string, Record<string, { "x-invalidate"?: unknown }>>;
    };

    expect(doc.paths["/api/hello"]?.post?.["x-invalidate"]).toEqual(["GET /api/hello"]);
  });
});
