// The games feature's entry: what routes and other features may import. Anything not exported here is internal.
export { CLIP_MAX_BYTES, isClipKey } from "./clips.ts";
export type { AgeRating, ClipShape, ContentMark, GamePart, GamePlaysOn } from "../../lib/server/db.ts";
export { connectHostsFrom, isMissingIndexHtml, megabytes } from "./files-check.ts";
export {
  ageProblem,
  gameFieldProblems,
  marksProblem,
  playsOnProblem,
  type GameField,
  type GameFieldProblems,
} from "./fields.ts";
export { GameError } from "./game-error.ts";
export { playsOnWords, ratingWords, websitesWords } from "./laid-out.ts";
export { beforeSendWords, nextStepWords, toFixWords, type MissingBeforeSend } from "./review.ts";
export { partNoun } from "./send-back.ts";
export {
  answersOf,
  counterOf,
  firstUnanswered,
  isQuestionAddress,
  QUESTIONS,
  questionBefore,
  questionOf,
  questionsFor,
  type QuestionId,
} from "./questions.ts";
export type { Answer, LiveGame, MakerGame } from "./service.ts";
export { gamesServices } from "./services.ts";
