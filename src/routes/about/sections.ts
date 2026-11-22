// Every word on the landing page (/about), section by section, in the order the page shows them. The screen draws what
// this file lists, so a feature that ships changes the words here and nothing else (this-repo, "The landing page keeps
// up"). Each line is something the product or the maker agreement already says: nothing here may promise more.

export interface Link {
  words: string;
  href: string;
}

export interface Section {
  /** The section's place on the page, for links like "#makers". */
  id: string;
  /** A small line above the heading that says who it is for, or "" for none. */
  forWhom: string;
  heading: string;
  lines: readonly string[];
  points: readonly string[];
  links: readonly Link[];
}

export interface Step {
  title: string;
  words: string;
}

/** The row of ways in at the top: the two audiences, then signing in. */
export const TOP_LINKS: readonly Link[] = [
  { words: "For players", href: "#players" },
  { words: "For makers", href: "#makers" },
];

export const SIGN_IN: Link = { words: "Sign in", href: "/sign-in?next=%2Fabout" };

/** One line of news above the headline: the newest thing worth a look. */
export const NEWS: Link = {
  words: "New: how to get your game on Ruken, step by step",
  href: "/help/get-your-game-on-ruken",
};

export const HERO = {
  heading: "Watch a game. Then play it.",
  lines: [
    "Ruken is a feed of short game clips. See one you like? Tap Play, and you're in the game.",
    "Nothing to download. It plays right here in your browser.",
  ],
  button: { words: "Watch the feed", href: "/" },
} as const;

/** The two audiences, makers first (as the order of the page's sections says). */
export const AUDIENCES: readonly Section[] = [
  {
    id: "makers",
    forWhom: "For makers",
    heading: "Made a game? Let people play it.",
    lines: ["People see your clip and ask where to play. On Ruken, your clip leads straight to your game."],
    points: [
      "Send your game from GitHub, on one form. A step-by-step guide shows you how.",
      "Members pay. After tax and Stripe's fees, half goes to makers, shared by how long members play.",
      "A person looks at every game. If it's a no, we always tell you why.",
      "Your game stays yours. Take it off Ruken any time.",
    ],
    links: [
      { words: "Put your game on Ruken", href: "/make" },
      { words: "Help for makers", href: "/help" },
    ],
  },
  {
    id: "players",
    forWhom: "For players",
    heading: "Find your next game in a swipe.",
    lines: [
      "Tired of digging through copycat games? Watch a few seconds of each one first. Play the ones you like.",
    ],
    points: [
      "Watching is free. You don't need an account.",
      "Tap Play and the game starts in your browser. Nothing to install.",
      "A person checks every game before it goes live.",
    ],
    links: [
      { words: "Watch the feed", href: "/" },
      { words: "See the price", href: "/join" },
    ],
  },
];

/** The membership's four cards. The price comes from the rules, so the first card is written from it. */
export function membershipCards(prices: { monthly: string; annual: string }): readonly string[] {
  return [
    `${prices.monthly} a month, or ${prices.annual} a year`,
    "Play every game on Ruken",
    "Your money helps pay the makers whose games you play",
    "Cancel any time from your account",
  ];
}

export const MEMBERSHIP = {
  heading: "One price. Every game.",
  note: "Tax is added where it applies.",
  button: { words: "Join Ruken", href: "/join" },
} as const;

export const STEPS = {
  heading: "How Ruken works",
  steps: [
    { title: "Makers send their games", words: "From GitHub, with two short videos of the game." },
    { title: "A person checks each one", words: "Only the games that pass go live." },
    { title: "You watch, tap Play and play", words: "Members play every game." },
  ] satisfies Step[],
} as const;

/** The sections after the steps, one under another, each a heading, a few lines and at most one link. */
export const MORE: readonly Section[] = [
  {
    id: "fans",
    forWhom: "For makers",
    heading: "Bring your fans",
    lines: [
      "Share your Ruken page or your game's link. When a fan joins from it, half of what they pay makers goes to you for their first 12 months, whatever they play.",
    ],
    points: [],
    links: [{ words: "Make your page", href: "/make/page" }],
  },
  {
    id: "safe",
    forWhom: "For players",
    heading: "Safe to play",
    lines: [],
    points: [
      "Games run apart from Ruken. A game never sees your sign-in.",
      "Ruken is for people 13 and up. Games marked 18+ are for adults only.",
      "No game may have pornography or gambling.",
    ],
    links: [],
  },
  {
    id: "pay",
    forWhom: "For makers",
    heading: "Makers' pay, in the open",
    lines: [
      "How makers are paid is written down for anyone to read.",
      "Statements are final on the 10th of each month and paid on the 15th.",
    ],
    points: [],
    links: [{ words: "Read the maker agreement", href: "/legal/maker-agreement" }],
  },
];

/** The two cards at the foot, one per audience, each with its one button. */
export const CLOSING: readonly { heading: string; button: Link }[] = [
  { heading: "Want to play?", button: { words: "Watch the feed", href: "/" } },
  { heading: "Made a game?", button: { words: "Put your game on Ruken", href: "/make" } },
];

export const FOOTER: readonly { heading: string; links: readonly Link[] }[] = [
  {
    heading: "Players",
    links: [
      { words: "Watch the feed", href: "/" },
      { words: "Join Ruken", href: "/join" },
      { words: "Your account", href: "/me" },
    ],
  },
  {
    heading: "Makers",
    links: [
      { words: "Your games", href: "/make" },
      { words: "Help for makers", href: "/help" },
      { words: "Maker agreement", href: "/legal/maker-agreement" },
    ],
  },
];
