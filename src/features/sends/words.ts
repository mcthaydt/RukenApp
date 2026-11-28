// Every word Your turn shows, in one place, so the screens and the journeys read the same ones.

export const SEND_WORDS = {
  tab: "Your turn",
  tabNew: "Your turn, new games",
  /** The share sheet's button in place of Email (the owner, 2026-11-27 14:48 UTC). */
  shareApp: "Your turn",
  pickTitle: "Send to friends",
  send: "Send",
  back: "Back",
  sentTo: (names: readonly string[]) =>
    names.length === 1 ? `Sent to ${names[0] ?? ""}.` : `Sent to ${String(names.length)} friends.`,
  pickFirst: "Pick a friend first.",
  noFriends: "No friends here yet. A friend is someone you follow who follows you back.",
  signInToSend: "Sign in to send games to friends.",
  failed: "That didn't work. Try again.",
  limited: "You've sent a lot today. Try again later.",
  from: (name: string) => `From ${name}`,
  empty: "Nothing yet. When a friend sends you a game, it shows up here.",
  everyGame: "See every game",
  signedOut: "Sign in to see games friends send you.",
  signIn: "Sign in",
  remove: (game: string) => `Remove ${game} from Your turn`,
  stop: (name: string) => `Stop games from ${name}`,
  stopAsk: (name: string) => `Stop games from ${name}? They won't be told.`,
  stopYes: "Stop",
  stopNo: "Keep",
  /** The friends whose games are kept out of Your turn ("People you stopped" before; the owner, 2026-11-28, asked what it was). */
  stoppedLink: "Friends who can't send you games",
  stoppedTitle: "Friends who can't send you games",
  stoppedEmpty: "Every friend can send you games.",
  undo: "Undo",
  undoLabel: (name: string) => `Let games from ${name} through again`,
  today: "Today",
  yesterday: "Yesterday",
  /** A sender whose page has gone since they sent. */
  someone: "a friend",
} as const;

/** The calendar day of a moment where the person is, as "2026-11-27", so two moments compare by day. */
function dayOf(moment: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

/** When a game was sent, as a person says it: "Today", "Yesterday", or the date ("Nov 3"). */
export function whenWords(sentAt: Date, now: Date, timeZone?: string): string {
  const day = dayOf(sentAt, timeZone);
  if (day === dayOf(now, timeZone)) return SEND_WORDS.today;
  if (day === dayOf(new Date(now.getTime() - 24 * 60 * 60_000), timeZone)) return SEND_WORDS.yesterday;
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(sentAt);
}
