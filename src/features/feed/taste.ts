import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { isAdultOn } from "../accounts/accounts.ts";
import { GENRES, isGenre, isMood, MOODS, tasteSentence } from "./taste-words.ts";

// What a person tells the feed about their taste (Your feed, the ••• sheet on a clip and the Good pick card): chips of
// more and less, the Learn from what I do switch, Start over, and the Good pick questions. It only keeps rows; how they
// move the order is the private ranker's. Built from what it needs, so a test hands it a database and a clock.

export type Direction = "more" | "less";
export type TasteKind = "mood" | "genre" | "maker" | "game";

/** Whether the feed may learn from this person: on, turned off by them, or locked off (under 18 with no parent's yes). */
export type Learning = "on" | "off" | "locked";

/** One chip: what it is about, and the words on it. */
export interface Chip {
  id: string;
  kind: TasteKind;
  value: string;
  words: string;
}

/** Something to pick in Add or as a suggestion; it is not a chip yet. */
export interface Choice {
  kind: TasteKind;
  value: string;
  words: string;
}

/** Everything Your feed shows. Chips and choices are empty unless learning is on. */
export interface YourFeed {
  learning: Learning;
  sentence: string;
  more: Chip[];
  less: Chip[];
  /** A few moods and genres the person has not picked, shown as outlined chips with a +. */
  suggestions: Choice[];
  /** What Add offers: every mood and genre and the makers with a live game, minus what is already a chip. */
  choices: { moods: Choice[]; genres: Choice[]; makers: Choice[] };
}

export type AddOutcome = "added" | "not-learning" | "unknown" | "own";

/** How many suggestions Your feed shows at once. */
const SUGGESTIONS = 2;

export interface TasteDeps {
  db: PrismaClient;
  clock: Clock;
}

export type Taste = ReturnType<typeof createTaste>;

export function createTaste(deps: TasteDeps) {
  const { db, clock } = deps;
  const now = () => new Date(clock.epochMs());

  async function learningOf(userId: string): Promise<Learning> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { adultOn: true, feedPersonal: true },
    });
    // A parent's yes (unit I) is not built yet, so an under-18 or anyone of unknown age is locked off.
    if (user === null || !isAdultOn(user.adultOn, clock)) return "locked";
    return user.feedPersonal ? "on" : "off";
  }

  /** Forgets what the feed learned: every chip and Good pick answer goes, and nothing before now is read again. */
  async function forget(userId: string, data: { feedPersonal?: boolean } = {}): Promise<void> {
    await db.$transaction([
      db.feedTaste.deleteMany({ where: { userId } }),
      db.goodPickAsked.deleteMany({ where: { userId } }),
      db.user.update({ where: { id: userId }, data: { ...data, feedResetAt: now() } }),
    ]);
  }

  /**
   * Keeps one chip, and takes away the same thing in the other direction: a person cannot want more and less of one
   * thing. Pressing the same again changes nothing.
   */
  async function keep(
    userId: string,
    direction: Direction,
    kind: TasteKind,
    value: string,
    ties: { makerUserId?: string; gameId?: string },
  ): Promise<void> {
    const other: Direction = direction === "more" ? "less" : "more";
    await db.$transaction([
      db.feedTaste.deleteMany({ where: { userId, direction: other, kind, value } }),
      db.feedTaste.createMany({
        data: [{ userId, direction, kind, value, ...ties, createdAt: now() }],
        skipDuplicates: true,
      }),
    ]);
  }

  /** Makers with a live game and a page, but not the person themselves, for Add. */
  async function makersToPick(userId: string): Promise<Choice[]> {
    const pages = await db.makerPage.findMany({
      where: { userId: { not: userId }, user: { games: { some: { state: "live" } } } },
      select: { userId: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    return pages.map((page) => ({ kind: "maker", value: page.userId, words: page.name }));
  }

  return {
    learningOf,

    /** Your feed, as its screen shows it. */
    async view(userId: string): Promise<YourFeed> {
      const learning = await learningOf(userId);
      if (learning !== "on") {
        const sentence = "Play a few games and we'll learn what you like.";
        return {
          learning,
          sentence,
          more: [],
          less: [],
          suggestions: [],
          choices: { moods: [], genres: [], makers: [] },
        };
      }
      const rows = await db.feedTaste.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          direction: true,
          kind: true,
          value: true,
          maker: { select: { makerPage: { select: { name: true } } } },
          game: { select: { name: true, state: true } },
        },
      });
      const chips: (Chip & { direction: Direction })[] = rows.flatMap((row) => {
        let words: string | null = null;
        if (row.kind === "mood" && isMood(row.value)) words = MOODS[row.value];
        else if (row.kind === "genre" && isGenre(row.value)) words = GENRES[row.value];
        else if (row.kind === "maker") words = row.maker?.makerPage?.name ?? null;
        // A game that is no longer on Ruken has nothing to show more or less of.
        else if (row.kind === "game" && row.game?.state === "live") words = row.game.name;
        return words === null
          ? []
          : [{ id: row.id, direction: row.direction, kind: row.kind, value: row.value, words }];
      });
      const chipOnly = ({ id, kind, value, words }: Chip): Chip => ({ id, kind, value, words });
      const more = chips.filter((chip) => chip.direction === "more").map(chipOnly);
      const less = chips.filter((chip) => chip.direction === "less").map(chipOnly);
      const taken = new Set(chips.map((chip) => `${chip.kind}:${chip.value}`));
      const free = (choice: Choice) => !taken.has(`${choice.kind}:${choice.value}`);
      const moods: Choice[] = Object.entries(MOODS).map(([value, words]) => ({ kind: "mood", value, words }));
      const genres: Choice[] = Object.entries(GENRES).map(([value, words]) => ({
        kind: "genre",
        value,
        words,
      }));
      return {
        learning,
        sentence: tasteSentence(
          more.filter((chip) => chip.kind === "mood" || chip.kind === "genre").map((chip) => chip.value),
        ),
        more,
        less,
        suggestions: [...moods, ...genres].filter(free).slice(0, SUGGESTIONS),
        choices: {
          moods: moods.filter(free),
          genres: genres.filter(free),
          makers: (await makersToPick(userId)).filter(free),
        },
      };
    },

    /** Adds a mood, genre or maker chip from Your feed. */
    async add(userId: string, direction: Direction, kind: TasteKind, value: string): Promise<AddOutcome> {
      if ((await learningOf(userId)) !== "on") return "not-learning";
      if (kind === "mood" && isMood(value)) await keep(userId, direction, kind, value, {});
      else if (kind === "genre" && isGenre(value)) await keep(userId, direction, kind, value, {});
      else if (kind === "maker") {
        if (value === userId) return "own";
        const page = await db.makerPage.findUnique({ where: { userId: value }, select: { userId: true } });
        if (page === null) return "unknown";
        await keep(userId, direction, kind, value, { makerUserId: value });
      } else return "unknown";
      return "added";
    },

    /** More like this or Less like this on a clip: a chip for that game. Nobody tunes their feed by their own game. */
    async aboutGame(userId: string, slug: string, direction: Direction): Promise<AddOutcome> {
      if ((await learningOf(userId)) !== "on") return "not-learning";
      const game = await db.game.findFirst({
        where: { slug, state: "live" },
        select: { id: true, makerUserId: true },
      });
      if (game === null) return "unknown";
      if (game.makerUserId === userId) return "own";
      await keep(userId, direction, "game", game.id, { gameId: game.id });
      return "added";
    },

    /** Removes one of the person's own chips. Someone else's chip, or one already gone, changes nothing. */
    async remove(userId: string, chipId: string): Promise<void> {
      await db.feedTaste.deleteMany({ where: { id: chipId, userId } });
    },

    /** Start over: what the feed learned about the person is forgotten. */
    async startOver(userId: string): Promise<void> {
      await forget(userId);
    },

    /**
     * Learn from what I do. Off keeps the chips but hides them and the feed stops learning; on again starts fresh, as
     * Start over does. Locked off for an under-18 without a parent's yes.
     */
    async setLearning(userId: string, on: boolean): Promise<"done" | "locked"> {
      const now = await learningOf(userId);
      if (now === "locked") return "locked";
      if (on && now === "off") await forget(userId, { feedPersonal: true });
      else if (!on && now === "on")
        await db.user.update({ where: { id: userId }, data: { feedPersonal: false } });
      return "done";
    },

    /**
     * Notes that the feed is asking this person "Good pick?" about a game, so it asks once. Answers false when it was
     * asked before, and the card is then not shown again.
     */
    async asking(userId: string, gameId: string): Promise<boolean> {
      const made = await db.goodPickAsked.createMany({
        data: [{ userId, gameId, askedAt: now() }],
        skipDuplicates: true,
      });
      return made.count === 1;
    },

    /**
     * The person's answer to Good pick. Yes is a "more" chip for the game and No a "less" one. (The learned spec says
     * the game's mood; games have no mood until that work is built, so the game itself stands in.) Only a question the
     * feed asked can be answered, once.
     */
    async answer(
      userId: string,
      slug: string,
      yes: boolean,
    ): Promise<"saved" | "not-asked" | "not-learning"> {
      if ((await learningOf(userId)) !== "on") return "not-learning";
      const game = await db.game.findUnique({ where: { slug }, select: { id: true } });
      if (game === null) return "not-asked";
      const gameId = game.id;
      const answered = await db.goodPickAsked.updateMany({
        where: { userId, gameId, answer: null },
        data: { answer: yes ? "yes" : "no" },
      });
      if (answered.count === 0) return "not-asked";
      await keep(userId, yes ? "more" : "less", "game", gameId, { gameId });
      return "saved";
    },
  };
}
