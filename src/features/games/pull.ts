import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { GitHub } from "./github.ts";

export interface PullDeps {
  db: PrismaClient;
  clock: Clock;
  github: GitHub;
  files: FileStore;
}

export interface Pull {
  id: string;
  commitSha: string;
  fileCount: number;
  totalBytes: number;
}

export function pullGame(_deps: PullDeps, gameId: string): Promise<Pull> {
  throw new Error(`not built yet: ${gameId}`);
}
