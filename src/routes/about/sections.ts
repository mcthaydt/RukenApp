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
  /** A real screenshot of the app beside the words, in static/about/. */
  picture?: { src: string; alt: string };
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
  words: "New: put your game on Ruken, step by step",
  href: "/help/get-your-game-on-ruken",
};

export const HERO = {
  /** Two sentences, each a line of its own. */
  heading: ["Watch a game.", "Then play it."],
  lines: [
    "Ruken is a feed of short game clips. See one you like? Members tap Play, and they're in the game.",
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
    // The owner, 2026-11-22 18:02 UTC: selective so the quality is high, a good page for maker and game that is easy
    // to make, pay from the members' pool, simple to send, and the feed brings the players.
    lines: ["Ruken is picky. Every game is checked by a person, so yours sits next to good ones."],
    points: [
      "The feed brings you players. Your clip shows, and one tap plays your game.",
      "Send your game from GitHub in six short questions.",
      "A good-looking page for you and for each game, made in minutes.",
      "Get paid. Half of what members pay, after tax and fees, goes to makers, shared by how long they play.",
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
    // The owner, 2026-11-22 18:02 UTC: play anywhere, no ads, a console-like experience, no slop because it's vetted.
    // 19:36 UTC: the console line names the comforts Ruken already has (a controller, the home-screen app), and "No slop."
    lines: ["Watch a few seconds of a game first. Play the ones you like."],
    points: [
      "Play anywhere: your phone, tablet or computer. Nothing to install.",
      "No ads. Not before a game, not during one.",
      "Pick up a controller. Games can use it, the way they do on a console.",
      "Put Ruken on your home screen. It opens full screen, like an app.",
      "No slop. A person checks every game before it goes live.",
    ],
    links: [
      { words: "Watch the feed", href: "/" },
      { words: "See the price", href: "/join" },
    ],
  },
];

/** The membership's four cards. The price comes from the rules, so the first card is written from it. */
export const MEMBERSHIP = {
  heading: "One price. Every game.",
  /** What a member gets, each a line with a tick beside the price. */
  perks: [
    "Play every game on Ruken",
    "Your money helps pay the makers whose games you play",
    "Cancel any time from your account",
  ],
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
    // The strategy's pains: the dead end after a viral clip, and nobody treating a maker's own audience as theirs.
    heading: "Your clip got seen. Now send them here.",
    lines: [
      "People see your clip and ask where to play. Your Ruken page is the answer: every game you've made, one tap from playing.",
    ],
    points: [
      "Bring a fan, and for their first 12 months half of their makers' share is yours, whatever they play.",
      "Not exclusive. Keep your game on itch.io or anywhere else too.",
    ],
    links: [{ words: "Make your page", href: "/make/page" }],
    picture: {
      src: "/about/maker-page.jpg",
      alt: "A maker's page on Ruken: their name, and their game with a Play button",
    },
  },
  {
    id: "safe",
    forWhom: "For players",
    // The strategy's pain for players: drowning in clones and ads. A person checks every game (maker agreement 3).
    heading: "Chosen by people. Safe to play.",
    lines: ["A person checks every game before it goes live. No clones, no ads, nothing sneaky."],
    points: [
      "Games run apart from Ruken. A game never sees your sign-in.",
      "Ruken is for people 13 and up. Games marked 18+ are for adults only.",
      "No game may have pornography, gambling or ads.",
      "See something wrong? Report the game, and we'll take a look.",
      "Like a maker? Press the plus on their picture to follow them.",
    ],
    links: [{ words: "Watch the feed", href: "/" }],
    picture: {
      src: "/about/feed.jpg",
      alt: "The Ruken feed on a phone: a game playing, with its name and a Play button",
    },
  },
  {
    id: "pay",
    forWhom: "For makers",
    heading: "Makers' pay, in the open",
    lines: [
      "How makers are paid is written down for anyone to read. No secret formula.",
      "Statements are final on the 10th of each month and paid on the 15th, once you're owed $25.",
    ],
    points: [],
    links: [{ words: "Read the maker agreement", href: "/legal/maker-agreement" }],
  },
];

/** The picture beside "Makers' pay": where a member's money goes, as the maker agreement says it. Each maker's own
 *  share is not shown until the statements are built. */
export const SPLIT = {
  title: "Where a member's money goes",
  parts: [
    { id: "fees", words: "Tax and Stripe's fees come off first." },
    { id: "makers", words: "Half of the rest goes to makers, shared by how long members play their games." },
    { id: "ruken", words: "The other half runs Ruken." },
  ],
} as const;

/** The two cards at the foot, one per audience, each with its one button. */
/** Each closing card sits on a still from Floor Fifty, blurred and dimmed, as Live sits on its own clip. */
export const CLOSING: readonly { heading: string; button: Link; glow: string }[] = [
  { heading: "Want to play?", button: { words: "Watch the feed", href: "/" }, glow: "/about/play-glow.jpg" },
  {
    heading: "Made a game?",
    button: { words: "Put your game on Ruken", href: "/make" },
    glow: "/about/make-glow.jpg",
  },
];

/**
 * Under the closing cards: most of Ruken's code is public (the owner, 2026-11-22 19:56 UTC: "a section under want to
 * play/made a game mentioning how it's open source and include github link"; 20:25 UTC: "we're making some things
 * private like the algo"). The feed's order and the checks that stop cheating live in the private repo. The licence is
 * the Functional Source License with an Apache 2.0 future (LICENSE.md): readable now, fully open source two years after
 * each version, and the words say exactly that.
 */
export const OPEN_CODE = {
  heading: "Built in the open.",
  lines: [
    "Most of Ruken's code is on GitHub for anyone to read. The parts that choose what's in your feed and stop cheats stay private.",
    "Two years after each version comes out, its public code becomes fully open source. The private parts stay private.",
  ],
  button: { words: "See the code on GitHub", href: "https://github.com/mcthaydt/RukenApp" },
} as const;

/** The button that stays in a corner, back to the feed from anywhere on the page. */
export const TO_FEED: Link = { words: "Back to the feed", href: "/" };

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
  {
    heading: "The small print",
    links: [
      { words: "Terms", href: "/terms" },
      { words: "Privacy", href: "/privacy" },
    ],
  },
];
