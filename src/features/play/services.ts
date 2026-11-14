import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { PlayService } from "./sessions.ts";

// Everything the play feature needs, built once per server process (stub: the settings are read once its tests have
// been seen failing).

export interface PlayServices {
  service: PlayService;
}

export function createPlayServices(
  source: Readonly<Record<string, string | undefined>>,
  parts: { db: PrismaClient; clock: Clock; address(name: string): string },
): PlayServices {
  throw new Error(
    `not built yet: createPlayServices ${String(Object.keys(source).length)} ${parts.address("x")}`,
  );
}

/** The process-wide play services, created on first use. */
export function playServices(): PlayServices {
  throw new Error("not built yet: playServices");
}
