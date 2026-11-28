// What playtesting hands its screens. Plain data, so a page's own script may import it.

/** One person on the Playtesters page: the row's id (the page's forms name it), their name and face, and the date. */
export interface PlaytestPerson {
  id: string;
  /** Null when their page has gone. */
  name: string | null;
  photo: string | null;
  /** Asking: when they asked. Playing: when they were let in, invited or came by the link. */
  at: Date;
  /** Playing only: "Since" for a yes to an ask, "Invited" for an invite or the link. */
  invited: boolean;
}

export interface PlaytestersPage {
  game: { slug: string; name: string };
  asking: boolean;
  waiting: PlaytestPerson[];
  playing: PlaytestPerson[];
}

/** One row on a player's Your turn list. */
export interface PlaytestNotice {
  id: string;
  slug: string;
  name: string;
  still: string | null;
  maker: string | null;
  /** "invited": the maker invited them. "let": the maker said yes to their ask. */
  kind: "invited" | "let";
  at: Date;
}

/** What a feed needs for every clip at once: the slugs that show the badge, and the slugs this person plays. */
export interface FeedPlaytest {
  badge: string[];
  play: string[];
}
