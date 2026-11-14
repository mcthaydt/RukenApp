import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

// Handing out play passes (stub: the code comes after its tests have been seen failing).

export interface PassDeps {
  db: PrismaClient;
  clock: Clock;
  passSecret: string;
}

export function passFor(
  deps: PassDeps,
  input: {
    game: { id: string; publicId: string };
    pull: { id: string; connectHosts: string[] };
    userId: string | null;
  },
): Promise<string> {
  return Promise.reject(
    new Error(`not built yet: passFor ${input.game.id} ${String(deps.passSecret.length)}`),
  );
}
