// The games feature's entry: what routes and other features may import. Anything not exported here is internal.
export { clipRequestTooBig, isClipKey } from "./clips.ts";
export type { AgeRating, ClipShape, ContentMark, GamePart, GamePlaysOn } from "../../lib/server/db.ts";
export { connectHostsFrom, isMissingIndexHtml, megabytes } from "./files-check.ts";
export { ageProblem, marksProblem, playsOnProblem } from "./fields.ts";
export { GameError } from "./game-error.ts";
export { playsOnWords, ratingWords, websitesWords } from "./laid-out.ts";
export { FILES_BEING_FIXED_WORDS, GAME_CHANGED_WORDS, nextStepWords, toFixWords } from "./review.ts";
export {
  isReasonFor,
  LIVE_MAY_BE_SENT_BACK,
  partNoun,
  partTitle,
  reasonsFor,
  SOMETHING_ELSE,
} from "./send-back.ts";
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
export type { Answer, LiveGame, MakerGame, ReviewDecision, ReviewGame, WaitingGame } from "./service.ts";
export { gamesServices } from "./services.ts";
