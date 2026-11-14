import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";
import type { LiveGame } from "../games/games.ts";
import type { PlayViewer } from "./may-play.ts";

// Play sessions and their beats (stub: the code comes after its tests have been seen failing).

export interface PlayServiceDeps {
  db: PrismaClient;
  clock: Clock;
  rateLimiter: RateLimiter;
  passSecret: string;
  /** A game's address from its name (`g-<public id>`). */
  address(name: string): string;
}

export type StartedPlay =
  { frameUrl: string; session: { id: string; token: string } } | { refused: "join" | "busy" };

export type BeatResult = "recorded" | "too_soon" | "over" | "unknown";

export function createPlayService(deps: PlayServiceDeps) {
  function startPlay(input: {
    game: LiveGame;
    viewer: PlayViewer | null;
    clientAddress: string;
  }): Promise<StartedPlay> {
    return Promise.reject(
      new Error(`not built yet: startPlay ${input.game.id} ${deps.address(input.clientAddress)}`),
    );
  }

  function recordBeat(input: { sessionId: string; token: string; attentive: boolean }): Promise<BeatResult> {
    return Promise.reject(new Error(`not built yet: recordBeat ${input.sessionId}`));
  }

  function playSummary(gameId: string): Promise<{ sessions: number; beats: number; countedSeconds: number }> {
    return Promise.reject(new Error(`not built yet: playSummary ${gameId}`));
  }

  return { startPlay, recordBeat, playSummary };
}

export type PlayService = ReturnType<typeof createPlayService>;
