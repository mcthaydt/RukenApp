import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { GamesService } from "./service.ts";

export interface GamesServices {
  service: GamesService;
  address(name: string): string;
}

export function createGamesServices(
  source: Readonly<Record<string, string | undefined>>,
  parts: { db: PrismaClient; clock: Clock; files: FileStore },
): GamesServices {
  throw new Error(`not built yet: ${String(source.GITHUB_APP_ID)} ${String(parts.db === undefined)}`);
}

export function gamesServices(): GamesServices {
  throw new Error("not built yet");
}
