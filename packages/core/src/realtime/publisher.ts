/**
 * The publisher `realtime()` returns, and the bus key of a topic. REST handlers publish through it into the route's
 * namespace, or another namespace on the same bus. Namespaces never see each other's topics.
 */
import type { StandardSchemaLike } from "../validation/standard-schema.ts";
import { inOrder, type SendCheck } from "../ws/messages.ts";
import type { RealtimeBus } from "./bus.ts";
import type { RealtimeSendOf } from "./messages.ts";

/**
 * What `realtime()` returns: publish into its route's namespace, or another namespace on its bus. `M` is the route's
 * `messages`: a route that declares `send` checks each publish, which may then be async.
 */
export type RealtimePublisher<M = {}> = {
  /**
   * Send `data` as one JSON frame to every connection on `topic`. Throws when `data` is not JSON, or a `TypeError` when
   * the send schema refuses it. While an async check is pending, it returns a promise that settles the same way: await
   * it. A refusal never stops later publishes.
   */
  publish(
    topic: string,
    data: RealtimeSendOf<M>,
  ): M extends { readonly send: StandardSchemaLike } ? Promise<void> | void : void;
  /** The publisher for another namespace on the same bus. Its publishes are never checked. */
  namespace(name: string): {
    /** Send `data` as one JSON frame to every connection on `topic` in this namespace. Throws when `data` is not JSON. */
    publish(topic: string, data: unknown): void;
  };
};

const SEP = "\u0000";

/** The bus key of `topic` in namespace `ns`. Namespaces never see each other's topics. */
export function topicKey(ns: string, topic: string): string {
  return ns + SEP + topic;
}

type Publish = (topic: string, data: unknown) => void | Promise<void>;

/** `publish` with each message checked first, in the order published; a refused one throws, or rejects. */
function checked(check: SendCheck, publish: Publish): Publish {
  const lane = inOrder(
    (message: { data: unknown; topic: string }) => check(message.data),
    ({ data, topic }) => publish(topic, data),
    (issue) => {
      throw new TypeError(`realtime publish: invalid message: ${issue}`);
    },
  );

  return (topic, data) => lane({ data, topic });
}

/** The publisher for `namespace` on `bus`, its publishes checked by `check` unless that is `null`. */
export function createRealtimePublisher(
  bus: RealtimeBus,
  namespace: string,
  check: SendCheck | null,
): RealtimePublisher {
  const forNs = (ns: string) => (topic: string, data: unknown) => bus.publish(topicKey(ns, String(topic)), data);
  const own = forNs(namespace);

  return {
    namespace: (name) => ({ publish: forNs(String(name)) }),
    publish: check === null ? own : checked(check, own),
  };
}
