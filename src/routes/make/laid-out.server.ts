import {
  gamesServices,
  questionOf,
  ratingWords,
  websitesWords,
  type MakerGame,
} from "../../features/games/games.ts";
import type { ChangePart, ChipPart, LaidOutGame } from "./laid-out.ts";

// A game as members will see it, ready for a screen: the words of its facts, the addresses of its videos, and where
// each part is changed. The facts' words are made once, in the games feature, so every screen says them the same way.

/** Every part of a game a maker can change. */
export const ALL_PARTS: readonly ChangePart[] = [
  "name",
  "one_line",
  "files",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

/** The three facts shown as chips, in the order they are shown, each with its words when the game has an answer. */
function chipsOf(game: MakerGame): { part: ChipPart; words: string }[] {
  const facts: [ChipPart, string | null][] = [
    ["files", game.repoFullName],
    ["age_rating", ratingWords(game.ageRating, game.contentMarks)],
    ["other_websites", websitesWords(game.connectHosts)],
  ];
  return facts.flatMap(([part, words]) => (words === null ? [] : [{ part, words }]));
}

/** The game laid out, with a Change on each of `changeable` parts. */
export function laidOut(game: MakerGame, changeable: readonly ChangePart[]): LaidOutGame {
  // Not taken apart: a detached method loses its owner (the lint rule unbound-method).
  const services = gamesServices();
  const changes: Partial<Record<ChangePart, string>> = {};
  for (const part of changeable) changes[part] = `/make/${game.slug}/${questionOf(part)}`;
  return {
    name: game.name,
    line: game.oneLine ?? "",
    upright: game.clips.upright === null ? null : services.media(game.clips.upright.key),
    wide: game.clips.wide === null ? null : services.media(game.clips.wide.key),
    chips: chipsOf(game),
    changes,
  };
}
