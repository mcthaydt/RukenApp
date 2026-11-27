// The sends feature's entry (Your turn): what routes and other features may import. Anything not exported here is
// internal.
export { isSendLimits, sendLimitsFrom, STAND_IN_SEND_LIMITS, type SendLimits } from "./limits.ts";
export {
  createSends,
  FRIENDS_MAX,
  type Friend,
  type SendOutcome,
  type Sends,
  type SentGame,
  type StoppedPerson,
} from "./service.ts";
export { sendsServices, setSendLimits } from "./services.ts";
export { SEND_WORDS, whenWords } from "./words.ts";
