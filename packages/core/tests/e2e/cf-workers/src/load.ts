import { createApp as createCompose } from "@backend/e2e-compose";
import { createApp as createDefaults } from "@backend/e2e-defaults";
import { createApp as createGateway } from "@backend/e2e-gateway";
import { createApp as createKitchen } from "@backend/e2e-kitchen";
import { createApp as createMcp } from "@backend/e2e-mcp";
import { createApp as createSurface } from "@backend/e2e-surface";
import type { WSAdapter } from "@workerstack/backend/http";

/** Each e2e app's factory, by the name `BACKEND_E2E_APP` and the e2e configs choose it with. */
type E2eApps = {
  readonly compose: typeof createCompose;
  readonly defaults: typeof createDefaults;
  readonly gateway: typeof createGateway;
  readonly kitchen: typeof createKitchen;
  readonly mcp: typeof createMcp;
  readonly surface: typeof createSurface;
};

const e2eApps: E2eApps = {
  compose: createCompose,
  defaults: createDefaults,
  gateway: createGateway,
  kitchen: createKitchen,
  mcp: createMcp,
  surface: createSurface,
};

type E2eAppName = keyof typeof e2eApps;

function isE2eAppName(name: string): name is E2eAppName {
  return name in e2eApps;
}

/** Any e2e app, as `loadE2eApp` hands it back. */
export type E2eApp = ReturnType<E2eApps[E2eAppName]>;

export function loadE2eApp(name: string | undefined, wsAdapter?: WSAdapter): E2eApp {
  const key = name ?? "kitchen";

  if (!isE2eAppName(key)) throw new Error(`unknown e2e app "${key}". known: ${Object.keys(e2eApps).join(", ")}`);

  return e2eApps[key](wsAdapter);
}
