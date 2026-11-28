// Every word playtesting shows, in one place, so the screens and the journeys read the same ones.

export const PLAYTEST_WORDS = {
  badge: "Playtest",
  ask: "Ask to playtest",
  asked: "You asked to playtest. We'll tell you in Your turn.",
  takeBack: "Take back my ask",
  tag: "Playtest",
  /** Beside a playtester's Play: they play free until launch, member or not (spec D1). */
  freeUntil: "Free until it opens on 30 November.",
  letYou: (maker: string) => `${maker} let you playtest`,
  invitedYou: (maker: string) => `${maker} invited you to playtest`,
  /** A maker or player whose page has gone. */
  someone: "Someone",

  link: "Playtesters",
  title: "Playtesters",
  lede: (game: string) => `${game}. Playtesters play free until it opens on 30 November.`,
  switch: "Let players ask to playtest",
  on: "On",
  off: "Off",
  onNote: (game: string) => `Players see a Playtest badge on ${game} and can ask.`,
  offNote: "Off: only people you invite can playtest.",
  invite: "Invite playtesters",
  sheetTitle: "Invite playtesters",
  copy: "Copy invite link",
  copied: "Copied",
  newLink: "Make a new link",
  invited: (name: string) => `Invited ${name}.`,
  inviteLabel: (name: string) => `Invite ${name}`,
  noFriends: "No friends here yet. Copy the link and send it any way you like.",
  asking: "Asking",
  wants: (name: string) => `${name} wants to playtest`,
  letPlay: (name: string) => `Let ${name} play`,
  sayNo: (name: string) => `Say no to ${name}`,
  playing: "Playing",
  since: (day: string) => `Since ${day}`,
  invitedOn: (day: string) => `Invited ${day}`,
  stop: (name: string) => `Stop ${name} playtesting`,
  stopAsk: (name: string) => `Stop ${name} playtesting? They won't be told.`,
  stopYes: "Stop",
  stopNo: "Keep",
  empty: "Nobody is playtesting yet. Invite a friend, or turn on asking so players can ask.",
  back: (game: string) => `Back to ${game}`,
  failed: "That didn't work. Try again.",
} as const;

/** A day as the Playtesters page says it: "Nov 26", in Chicago (where the money and launch dates are). */
export function dayWords(moment: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  }).format(moment);
}
