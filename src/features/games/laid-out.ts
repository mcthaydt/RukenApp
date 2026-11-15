import type { AgeRating, ContentMark, GamePlaysOn } from "../../lib/server/db.ts";

// Not built yet: the red of the task that builds it.

export function playsOnWords(playsOn: GamePlaysOn | null): string | null {
  throw new Error(`not built yet: playsOnWords(${String(playsOn)})`);
}

export function ratingWords(ageRating: AgeRating | null, marks: readonly ContentMark[]): string | null {
  throw new Error(`not built yet: ratingWords(${String(ageRating)}, ${marks.join(",")})`);
}

export function websitesWords(hosts: readonly string[]): string {
  throw new Error(`not built yet: websitesWords(${hosts.join(",")})`);
}
