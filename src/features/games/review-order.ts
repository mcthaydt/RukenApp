import type { GamePart } from "../../lib/server/db.ts";

// The Owner's review command: what it says is read here, from a body that arrives from outside and is never believed.
// It judges the shape only. The words themselves, and which parts a live game allows, are the service's to judge.

export type ReviewOrder =
  | { do: "list" }
  /** Every game players reported (report-a-game spec). */
  | { do: "reports" }
  | { do: "look"; game: string }
  /** `seen` is the time a look answered; an update that holds a video or rating is accepted only with it. */
  | { do: "accept"; game: string; seen?: string }
  | { do: "send-back"; game: string; parts: { part: GamePart; words: string }[] };

const GAME_PARTS: readonly GamePart[] = [
  "name",
  "one_line",
  "files",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

const WHAT_TO_DO = 'Say what to do: "do" is "list", "reports", "look", "accept" or "send-back".';
const WHICH_GAME = 'Say which game: "game" is its address from the list.';
const WHAT_IS_WRONG =
  'Say what\'s wrong: "parts" is a list like [{ "part": "files", "words": "It doesn\'t start." }].';
const NOT_A_PART = `That part isn't one of: ${GAME_PARTS.join(", ")}.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The order a body holds, or the one plain sentence that says what to type instead. */
export function readReviewOrder(body: unknown): ReviewOrder | { problem: string } {
  if (!isRecord(body)) return { problem: WHAT_TO_DO };
  const action = body.do;
  if (action === "list") return { do: "list" };
  if (action === "reports") return { do: "reports" };
  if (action !== "look" && action !== "accept" && action !== "send-back") return { problem: WHAT_TO_DO };

  const game = body.game;
  if (typeof game !== "string" || game.trim() === "") return { problem: WHICH_GAME };
  if (action === "accept") {
    // Only its shape is judged here. Whether it is a time, and the time of the latest look, is for the accept to judge.
    return typeof body.seen === "string" ? { do: "accept", game, seen: body.seen } : { do: "accept", game };
  }
  if (action === "look") return { do: "look", game };

  const { parts } = body;
  if (!Array.isArray(parts) || parts.length === 0) return { problem: WHAT_IS_WRONG };
  const read: { part: GamePart; words: string }[] = [];
  for (const item of parts as unknown[]) {
    if (!isRecord(item) || typeof item.part !== "string" || typeof item.words !== "string")
      return { problem: WHAT_IS_WRONG };
    const part = GAME_PARTS.find((one) => one === item.part);
    if (part === undefined) return { problem: NOT_A_PART };
    read.push({ part, words: item.words });
  }
  return { do: "send-back", game, parts: read };
}
