/**
 * What staff were last told about a game they decided on, said once on the list they land on: a person who presses Accept
 * or Send back sees the game go from the list, and without a word could not tell whether it went live, was sent back or was
 * lost.
 */
export type Decision = "accepted_game" | "accepted_update" | "sent_back" | "not_waiting";

/**
 * The line for a decision, with the game's name in it. `not_waiting` is a game someone else decided first, or one that was
 * never waiting; it names no one, because a stale page cannot tell which.
 */
export function decisionWords(decision: Decision, name: string): string {
  switch (decision) {
    case "accepted_game":
      return `${name} is live.`;
    case "accepted_update":
      return `The update to ${name} is live.`;
    case "sent_back":
      return `${name} was sent back. Its maker can see why.`;
    case "not_waiting":
      return `${name} isn't waiting for a check any more.`;
  }
}

/**
 * The cookie that carries the line from the page that decided to the list it lands on, as Your games carries "was thrown
 * away". It lives a minute, is read once and deleted, and is only for the person who decided: it holds the words and
 * nothing else.
 */
export const CHECKED_NOTE = {
  name: "checked-note",
  path: "/admin/games",
  maxAgeSeconds: 60,
} as const;
