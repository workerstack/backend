/** The types of spawners.js, for the TypeScript that imports it (spawning-exports.ts, the tests). */

/** The spawning names of a file, and each namespace it imports mapped to the names on it that spawn. */
export type SpawnScope = { names: Set<string>; namespaces: Map<string, ReadonlySet<string>> };

/** A parsed module: what spawnScope walks. */
export type SpawnProgram = { body: ReadonlyArray<Record<string, unknown> & { type: string }> };

export declare const DEFERRED: ReadonlyMap<string, ReadonlyMap<string, string>>;

export declare const SPAWNING_HELPERS: ReadonlyMap<string, readonly string[]>;

export declare function repoPath(filename: unknown): string | undefined;

export declare function spawnsIn(node: unknown, scope: SpawnScope): boolean;

export declare function spawnScope(
  program: SpawnProgram,
  from: string,
  helpers?: ReadonlyMap<string, readonly string[]>,
): SpawnScope;
