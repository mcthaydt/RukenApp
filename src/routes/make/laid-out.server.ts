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
  // A live game's rating that waits for a yes is the one its maker asked for, so it is the one laid out.
  const rating = game.held ?? { ageRating: game.ageRating, contentMarks: game.contentMarks };
  const facts: [ChipPart, string | null][] = [
    ["files", game.repoFullName],
    ["age_rating", ratingWords(rating.ageRating, rating.contentMarks)],
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
  // A live game's new video that waits for a yes is the one its maker chose, so it is the one laid out.
  const upright = game.heldClips.upright ?? game.clips.upright;
  const wide = game.heldClips.wide ?? game.clips.wide;
  return {
    name: game.name,
    line: game.oneLine ?? "",
    upright: upright === null ? null : services.media(upright.key),
    wide: wide === null ? null : services.media(wide.key),
    chips: chipsOf(game),
    waiting: [
      ...(game.heldClips.upright === null ? [] : (["upright_video"] as const)),
      ...(game.heldClips.wide === null ? [] : (["wide_video"] as const)),
      ...(game.held === null ? [] : (["age_rating"] as const)),
    ],
    changes,
  };
}
