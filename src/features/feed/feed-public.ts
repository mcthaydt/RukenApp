// The three feed settings the app itself acts on, from the Worker secret FEED_PUBLIC, loaded by the private repository's
// workflow from the same file as the private Worker's settings so the two never disagree. They are switches and a keeping
// period people are told about, not tuning: whether the feed may learn from a person at all, whether it may for an
// under-18 with a parent's yes, and how many days watching rows are kept. Every other feed setting lives only with the
// private ranker.

export interface FeedPublic {
  learned: boolean;
  teenPersonal: boolean;
  windowDays: number;
}

/**
 * Each setting's safe side, used when the secret is missing, is not JSON, or holds a bad value for it: learn from
 * nobody, and keep watching rows only a short while.
 */
export const FEED_PUBLIC_DEFAULTS: FeedPublic = { learned: false, teenPersonal: false, windowDays: 7 };

const isDays = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 365;

/**
 * Reads FEED_PUBLIC. A setting that is missing or bad falls to its safe side, and one line is logged naming the
 * setting, never a value.
 */
export function readFeedPublic(raw: string | undefined, log: (line: string) => void): FeedPublic {
  if (raw === undefined || raw === "") return { ...FEED_PUBLIC_DEFAULTS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log("feed: FEED_PUBLIC is not JSON; every feed setting is on its safe side.");
    return { ...FEED_PUBLIC_DEFAULTS };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    log("feed: FEED_PUBLIC is not a list of settings; every feed setting is on its safe side.");
    return { ...FEED_PUBLIC_DEFAULTS };
  }
  const given = parsed as Record<string, unknown>;
  const settings = { ...FEED_PUBLIC_DEFAULTS };
  const fallBack = (name: keyof FeedPublic) => {
    log(`feed: FEED_PUBLIC ${name} is missing or bad; it is on its safe side.`);
  };
  for (const name of ["learned", "teenPersonal"] as const) {
    const value = given[name];
    if (typeof value === "boolean") settings[name] = value;
    else fallBack(name);
  }
  if (isDays(given.windowDays)) settings.windowDays = given.windowDays;
  else fallBack("windowDays");
  return settings;
}

/** What the app knows about the person asking, for deciding whether the feed may learn from them. */
export interface Person {
  /** The signed-in account, or null for a visitor. */
  userId: string | null;
  /** Whether this browser said yes to cookies. */
  consented: boolean;
  adult: boolean;
  /** Whether a parent said yes, for an under-18. */
  parentSaidYes: boolean;
  /** Your feed's Learn from what I do: off, the feed treats the person as the crowd. */
  learnFromMe: boolean;
}

/** Who the ranker is told is asking, without a seed. */
export type Asking = { kind: "crowd" } | { kind: "full"; id: string };

export const CROWD: Asking = { kind: "crowd" };

/**
 * Whether the feed may learn from this person. Only a signed-in person whose browser said yes to cookies, while
 * `learned` is on, and, under 18, only with a parent's yes while `teenPersonal` is on. Everyone else is the crowd: the
 * ranker is told nothing about them.
 */
export function askingFor(settings: FeedPublic, person: Person): Asking {
  if (!settings.learned || person.userId === null || !person.consented || !person.learnFromMe) return CROWD;
  if (!person.adult && !(settings.teenPersonal && person.parentSaidYes)) return CROWD;
  return { kind: "full", id: person.userId };
}
