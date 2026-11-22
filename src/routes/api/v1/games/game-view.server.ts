import { answersOf, firstUnanswered, ratingWords, type MakerGame } from "../../../../features/games/games.ts";

/**
 * A game as the command line shows it: where it stands in words, what is left to answer, what staff sent back, and what
 * waits for review. The words are the ones the game's screen shows; nothing here is typed by anyone.
 */
export function gameView(game: MakerGame) {
  const video = (shape: "upright" | "wide") => {
    const waiting = game.heldClips[shape];
    const current = game.clips[shape];
    return {
      added: (waiting ?? current) !== null,
      bytes: (waiting ?? current)?.bytes ?? null,
      waitsForReview: waiting !== null,
    };
  };
  return {
    game: game.slug,
    name: game.name,
    state: game.state,
    words: game.words,
    reason: game.reason,
    oneLine: game.oneLine,
    ageRating: game.ageRating,
    rating: ratingWords(game.ageRating, game.contentMarks),
    heldRating: game.held === null ? null : ratingWords(game.held.ageRating, game.held.contentMarks),
    contentMarks: game.contentMarks,
    heldAgeRating: game.held?.ageRating ?? null,
    heldContentMarks: game.held?.contentMarks ?? [],
    playerCount: game.showsPlayerCount,
    files: { repo: game.repoFullName, branch: game.repoBranch, folder: game.repoFolder },
    websites: game.connectHosts,
    pullProblem: game.pullProblem,
    videos: { upright: video("upright"), wide: video("wide") },
    waitsForReview: game.hasPending,
    next: firstUnanswered(answersOf(game)),
    toFix: game.toFix.map((one) => ({ part: one.part, title: one.title, words: one.words, note: one.note })),
  };
}
