import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { stillOfClip } from "../../lib/stills.ts";
import type { ListedGame } from "../games/games.ts";
import { isOpen } from "../launch/launch.ts";
import type { Friend } from "../sends/sends.ts";
import { newLinkToken } from "./link.ts";
import { lookOf, NO_LOOK, type LookRow, type PlaytestLook } from "./look.ts";
import type { FeedPlaytest, PlaytestersPage, PlaytestNotice, PlaytestPerson } from "./types.ts";

// Playtesting (playtesting spec): before launch, a maker lets chosen players play their live game early. A player asks,
// or the maker invites them or shares a link; the maker says yes or no, and can take someone off. The state table in
// the spec is the rule every function here follows; tests/features/playtest/playtest.pg.test.ts checks every cell.
//
// Every change is one guarded update on the state it expects, so two presses or two tabs never do it twice. Every call
// is handed the launch time (see launch/now.ts) and does nothing from launch on: playtesting ends there.

export interface PlaytestDeps {
  db: PrismaClient;
  clock: Clock;
  liveGames(): Promise<ListedGame[]>;
  makersOf(
    userIds: readonly string[],
  ): Promise<Map<string, { handle: string; name: string; photoKey: string | null }>>;
  /** The whole address of a file in the bucket, from its key. */
  media(key: string): string;
  /** Who counts as a friend: the same rule as Your turn's. */
  canSend(fromId: string, toId: string): Promise<boolean>;
  /** A maker's friends' faces, as Your turn's picker shows them. */
  friendsOf(userId: string): Promise<Friend[]>;
}

/** A game as the maker's Playtesters page needs it. */
interface MakersGame {
  id: string;
  slug: string;
  name: string;
  playtestAsking: boolean;
}

export type Playtest = ReturnType<typeof createPlaytest>;

const LOOK_SELECT = { state: true, takenBackAt: true } as const;

/** How wide a Your turn row's still is fetched, as Your turn's own rows are. */
const THUMBNAIL_WIDTH = 240;

function thumbnailOf(clip: string): string | null {
  const still = stillOfClip(clip);
  return still === null ? null : `${still.address}?at=0&width=${String(THUMBNAIL_WIDTH)}`;
}

/** True before launch: the one guard every call goes through. */
function before(launchNowMs: number): boolean {
  return !isOpen(launchNowMs);
}

export function createPlaytest(deps: PlaytestDeps) {
  const { db, clock } = deps;
  const now = () => new Date(clock.epochMs());

  /** A live game by its address, with what playtesting reads; null when it is not live. */
  function liveGame(slug: string) {
    return db.game.findFirst({
      where: { slug, state: "live", livePullId: { not: null } },
      select: { id: true, slug: true, name: true, makerUserId: true, playtestAsking: true, ageRating: true },
    });
  }

  /** The maker's own live game, or null for anyone else (the routes answer 404). */
  async function makersGame(makerId: string, slug: string): Promise<MakersGame | null> {
    const game = await liveGame(slug);
    if (game?.makerUserId !== makerId) return null;
    return { id: game.id, slug: game.slug, name: game.name, playtestAsking: game.playtestAsking };
  }

  /** Whether an 18+ game may be shown to this person: the caller's own `isAdult`, asked only for an 18+ game. */
  async function mayShow(ageRating: string | null, isAdult: () => Promise<boolean>): Promise<boolean> {
    return ageRating !== "age_18" || (await isAdult());
  }

  /** Sets the row's Your turn time once, the first time it is let in. */
  function noticeOnce(gameId: string, userId: string) {
    return db.playtester.updateMany({
      where: { gameId, userId, state: "in", noticeAt: null },
      data: { noticeAt: now() },
    });
  }

  async function peopleOf(rows: { id: string; userId: string; at: Date | null; invited: boolean }[]) {
    const pages =
      rows.length === 0 ? new Map<string, never>() : await deps.makersOf(rows.map((row) => row.userId));
    return rows.map((row): PlaytestPerson => {
      const page = pages.get(row.userId);
      const photoKey = page?.photoKey ?? null;
      return {
        id: row.id,
        name: page?.name ?? null,
        photo: photoKey === null ? null : deps.media(photoKey),
        at: row.at ?? new Date(0),
        invited: row.invited,
      };
    });
  }

  /** The Your turn rows this person may see: let in, with a notice, not hidden, on a live game they may see. */
  async function shownNotices(userId: string, isAdult: () => Promise<boolean>) {
    const rows = await db.playtester.findMany({
      where: { userId, state: "in", noticeAt: { not: null }, noticeGoneAt: null },
      select: { id: true, gameId: true, via: true, noticeAt: true, noticeSeenAt: true },
    });
    if (rows.length === 0) return [];
    const wanted = new Set(rows.map((row) => row.gameId));
    const live = (await deps.liveGames()).filter((game) => wanted.has(game.id));
    const adult = live.some((game) => game.ageRating === "age_18") && (await isAdult());
    const games = new Map(
      live.filter((game) => adult || game.ageRating !== "age_18").map((game) => [game.id, game]),
    );
    return rows.flatMap((row) => {
      const game = games.get(row.gameId);
      return game === undefined ? [] : [{ row, game }];
    });
  }

  return {
    /** What this person sees of a game's playtest (null: signed out). */
    async viewOf(slug: string, viewerId: string | null, launchNowMs: number): Promise<PlaytestLook> {
      if (!before(launchNowMs)) return NO_LOOK;
      const game = await liveGame(slug);
      if (game === null) return NO_LOOK;
      const row =
        viewerId === null
          ? null
          : await db.playtester.findUnique({
              where: { gameId_userId: { gameId: game.id, userId: viewerId } },
              select: LOOK_SELECT,
            });
      return lookOf(row, { asking: game.playtestAsking, isMaker: game.makerUserId === viewerId });
    },

    /** The same look for every live game at once, as the feed needs it: the feed's later pages read it too. */
    async feedStateFor(viewerId: string | null, launchNowMs: number): Promise<FeedPlaytest> {
      if (!before(launchNowMs)) return { badge: [], play: [] };
      const [games, rows] = await Promise.all([
        // Only a game with asking on can show the badge, and only one this person plays shows their Play.
        db.game.findMany({
          where: {
            state: "live",
            livePullId: { not: null },
            OR: [
              { playtestAsking: true },
              ...(viewerId === null
                ? []
                : [{ playtesters: { some: { userId: viewerId, state: "in" as const } } }]),
            ],
          },
          select: { id: true, slug: true, makerUserId: true, playtestAsking: true },
        }),
        viewerId === null
          ? Promise.resolve([])
          : db.playtester.findMany({ where: { userId: viewerId }, select: { gameId: true, ...LOOK_SELECT } }),
      ]);
      const rowOf = new Map<string, LookRow>(rows.map((row) => [row.gameId, row]));
      const state: FeedPlaytest = { badge: [], play: [] };
      for (const game of games) {
        const look = lookOf(rowOf.get(game.id) ?? null, {
          asking: game.playtestAsking,
          isMaker: game.makerUserId === viewerId,
        });
        if (look.badge) state.badge.push(game.slug);
        if (look.action === "play") state.play.push(game.slug);
      }
      return state;
    },

    /** Whether this person plays this game as a playtester: let in, on a live game, before launch. */
    async isPlaytester(gameId: string, userId: string, launchNowMs: number): Promise<boolean> {
      if (!before(launchNowMs)) return false;
      const row = await db.playtester.findFirst({
        where: { gameId, userId, state: "in", game: { state: "live", livePullId: { not: null } } },
        select: { id: true },
      });
      return row !== null;
    },

    /**
     * A player asks. A new ask is a new row; a no they took back is shown as their ask again, and stays a no, so it never
     * comes back to the maker's Asking list. Refused with the switch off, for the maker, and for an 18+ game the person
     * may not see.
     */
    async ask(
      userId: string,
      slug: string,
      launchNowMs: number,
      isAdult: () => Promise<boolean>,
    ): Promise<"asked" | "refused"> {
      if (!before(launchNowMs)) return "refused";
      const game = await liveGame(slug);
      if (game === null || !game.playtestAsking || game.makerUserId === userId) return "refused";
      if (!(await mayShow(game.ageRating, isAdult))) return "refused";
      const made = await db.playtester.createMany({
        data: [{ gameId: game.id, userId, state: "asked", via: "ask", askedAt: now() }],
        skipDuplicates: true,
      });
      if (made.count === 0) {
        await db.playtester.updateMany({
          where: { gameId: game.id, userId, state: "declined", takenBackAt: { not: null } },
          data: { takenBackAt: null },
        });
      }
      return "asked";
    },

    /** A player takes back their ask: an ask waiting is deleted; a no only looks taken back, and stays a no. */
    async takeBack(userId: string, slug: string, launchNowMs: number): Promise<"taken back" | "refused"> {
      if (!before(launchNowMs)) return "refused";
      const game = await liveGame(slug);
      if (game === null || game.makerUserId === userId) return "refused";
      const gone = await db.playtester.deleteMany({ where: { gameId: game.id, userId, state: "asked" } });
      if (gone.count === 0) {
        await db.playtester.updateMany({
          where: { gameId: game.id, userId, state: "declined", takenBackAt: null },
          data: { takenBackAt: now() },
        });
      }
      return "taken back";
    },

    /** The maker's Playtesters page, or null when this is not their live game (404) or it is launch. */
    async pageFor(makerId: string, slug: string, launchNowMs: number): Promise<PlaytestersPage | null> {
      if (!before(launchNowMs)) return null;
      const game = await makersGame(makerId, slug);
      if (game === null) return null;
      const rows = await db.playtester.findMany({
        where: { gameId: game.id, state: { in: ["asked", "in"] } },
        orderBy: [{ askedAt: "desc" }, { decidedAt: "desc" }, { id: "desc" }],
        select: { id: true, userId: true, state: true, via: true, askedAt: true, decidedAt: true },
      });
      const waiting = await peopleOf(
        rows
          .filter((row) => row.state === "asked")
          .map((row) => ({ id: row.id, userId: row.userId, at: row.askedAt, invited: false })),
      );
      const playing = await peopleOf(
        rows
          .filter((row) => row.state === "in")
          .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0))
          .map((row) => ({ id: row.id, userId: row.userId, at: row.decidedAt, invited: row.via !== "ask" })),
      );
      return { game: { slug: game.slug, name: game.name }, asking: game.playtestAsking, waiting, playing };
    },

    /** Turns asking on or off. Only the badge and Ask change; waiting asks, invites and the link go on working. */
    async setAsking(makerId: string, slug: string, on: boolean, launchNowMs: number): Promise<boolean> {
      if (!before(launchNowMs)) return false;
      const game = await makersGame(makerId, slug);
      if (game === null) return false;
      await db.game.update({ where: { id: game.id }, data: { playtestAsking: on } });
      return true;
    },

    /** The maker says yes or no to an ask. Anything but a waiting ask of this game changes nothing. */
    async answer(
      makerId: string,
      slug: string,
      rowId: string,
      yes: boolean,
      launchNowMs: number,
    ): Promise<boolean> {
      if (!before(launchNowMs)) return false;
      const game = await makersGame(makerId, slug);
      if (game === null) return false;
      const changed = await db.playtester.updateMany({
        where: { id: rowId, gameId: game.id, state: "asked" },
        data: { state: yes ? "in" : "declined", decidedAt: now() },
      });
      if (yes && changed.count === 1) {
        await db.playtester.updateMany({ where: { id: rowId, noticeAt: null }, data: { noticeAt: now() } });
      }
      return true;
    },

    /** The maker takes a playtester off. They are not told; their Your turn row goes. */
    async remove(makerId: string, slug: string, rowId: string, launchNowMs: number): Promise<boolean> {
      if (!before(launchNowMs)) return false;
      const game = await makersGame(makerId, slug);
      if (game === null) return false;
      await db.playtester.updateMany({
        where: { id: rowId, gameId: game.id, state: "in" },
        data: { state: "removed", noticeGoneAt: now() },
      });
      return true;
    },

    /**
     * The maker invites a friend. Made for every friend whatever their age, as a send is: an 18+ game is hidden on the
     * friend's side, so nothing the maker sees says how old a friend is. Someone already playing changes nothing.
     */
    async invite(
      makerId: string,
      slug: string,
      handle: string,
      launchNowMs: number,
    ): Promise<"invited" | "refused"> {
      if (!before(launchNowMs)) return "refused";
      const [game, page] = await Promise.all([
        makersGame(makerId, slug),
        db.makerPage.findUnique({ where: { handle }, select: { userId: true } }),
      ]);
      if (game === null || page === null || page.userId === makerId) return "refused";
      const userId = page.userId;
      if (!(await deps.canSend(makerId, userId))) return "refused";
      const made = await db.playtester.createMany({
        data: [{ gameId: game.id, userId, state: "in", via: "invite", decidedAt: now(), noticeAt: now() }],
        skipDuplicates: true,
      });
      if (made.count === 0) {
        const changed = await db.playtester.updateMany({
          where: { gameId: game.id, userId, state: { in: ["asked", "declined", "removed"] } },
          data: { state: "in", via: "invite", decidedAt: now(), takenBackAt: null, noticeGoneAt: null },
        });
        if (changed.count === 1) await noticeOnce(game.id, userId);
      }
      return "invited";
    },

    /** The maker's friends for the invite sheet, each ticked when they already play. */
    async inviteFaces(makerId: string, slug: string): Promise<(Friend & { invited: boolean })[]> {
      const game = await liveGame(slug);
      if (game?.makerUserId !== makerId) return [];
      const friends = await deps.friendsOf(makerId);
      if (friends.length === 0) return [];
      const playing = await db.playtester.findMany({
        where: {
          gameId: game.id,
          state: "in",
          user: { makerPage: { handle: { in: friends.map((f) => f.handle) } } },
        },
        select: { user: { select: { makerPage: { select: { handle: true } } } } },
      });
      const ticked = new Set(playing.map((row) => row.user.makerPage?.handle));
      return friends.map((friend) => ({ ...friend, invited: ticked.has(friend.handle) }));
    },

    /** The game's invite link's token, made the first time it is asked for and the same every time after. */
    async linkFor(makerId: string, slug: string, launchNowMs: number): Promise<string | null> {
      if (!before(launchNowMs)) return null;
      const game = await makersGame(makerId, slug);
      if (game === null) return null;
      await db.playtestLink.createMany({
        data: [{ gameId: game.id, token: newLinkToken(), madeAt: now() }],
        skipDuplicates: true,
      });
      const link = await db.playtestLink.findUniqueOrThrow({
        where: { gameId: game.id },
        select: { token: true },
      });
      return link.token;
    },

    /** Makes a new link; the old one is kept as an old link, which leads to the game's page and changes nothing. */
    async newLink(makerId: string, slug: string, launchNowMs: number): Promise<string | null> {
      if (!before(launchNowMs)) return null;
      const game = await makersGame(makerId, slug);
      if (game === null) return null;
      const token = newLinkToken();
      await db.$transaction(async (tx) => {
        const old = await tx.playtestLink.findUnique({ where: { gameId: game.id }, select: { token: true } });
        if (old !== null) {
          // Two presses at once both read the same old token; the second keeps it once.
          await tx.playtestOldLink.createMany({
            data: [{ token: old.token, gameId: game.id, replacedAt: now() }],
            skipDuplicates: true,
          });
        }
        await tx.playtestLink.upsert({
          where: { gameId: game.id },
          create: { gameId: game.id, token, madeAt: now() },
          update: { token, madeAt: now() },
        });
      });
      return token;
    },

    /**
     * Someone opens an invite link: with no row they become a playtester; an ask waiting counts as a yes. A no, a
     * removal or the maker's own open change nothing, so the link never undoes the maker's answer. It makes no Your
     * turn row: the person is already on the game's page. A replaced link only leads to the game's page. The game's
     * address, or null for a token that matches nothing.
     */
    async openLink(
      userId: string,
      token: string,
      launchNowMs: number,
      isAdult: () => Promise<boolean>,
    ): Promise<string | null> {
      const link = await db.playtestLink.findUnique({
        where: { token },
        select: {
          game: {
            select: {
              id: true,
              slug: true,
              state: true,
              livePullId: true,
              makerUserId: true,
              ageRating: true,
            },
          },
        },
      });
      if (link === null) {
        // A link the maker replaced still leads to the game's page, so nobody sent it is lost; it changes nothing.
        const old = await db.playtestOldLink.findUnique({
          where: { token },
          select: { game: { select: { slug: true } } },
        });
        return old?.game.slug ?? null;
      }
      const game = link.game;
      const live = game.state === "live" && game.livePullId !== null;
      if (!live || !before(launchNowMs) || game.makerUserId === userId) return game.slug;
      if (!(await mayShow(game.ageRating, isAdult))) return game.slug;
      const made = await db.playtester.createMany({
        data: [{ gameId: game.id, userId, state: "in", via: "link", decidedAt: now() }],
        skipDuplicates: true,
      });
      if (made.count === 0) {
        await db.playtester.updateMany({
          where: { gameId: game.id, userId, state: "asked" },
          data: { state: "in", via: "link", decidedAt: now() },
        });
      }
      return game.slug;
    },

    /** This person's Your turn rows, newest first. */
    async noticesOf(
      userId: string,
      isAdult: () => Promise<boolean>,
      launchNowMs: number,
    ): Promise<PlaytestNotice[]> {
      if (!before(launchNowMs)) return [];
      const shown = await shownNotices(userId, isAdult);
      if (shown.length === 0) return [];
      const makers = await deps.makersOf([...new Set(shown.map(({ game }) => game.makerUserId))]);
      return shown
        .map(({ row, game }): PlaytestNotice => ({
          id: row.id,
          slug: game.slug,
          name: game.name,
          still: thumbnailOf(deps.media(game.clips.upright)),
          maker: makers.get(game.makerUserId)?.name ?? null,
          kind: row.via === "ask" ? "let" : "invited",
          at: row.noticeAt ?? new Date(0),
        }))
        .sort((a, b) => b.at.getTime() - a.at.getTime());
    },

    /** Whether a row this person may see is new: what lights the Your turn tab's dot. */
    async hasNew(userId: string, isAdult: () => Promise<boolean>, launchNowMs: number): Promise<boolean> {
      if (!before(launchNowMs)) return false;
      const unseen = await db.playtester.count({
        where: { userId, state: "in", noticeAt: { not: null }, noticeGoneAt: null, noticeSeenAt: null },
      });
      if (unseen === 0) return false;
      return (await shownNotices(userId, isAdult)).some(({ row }) => row.noticeSeenAt === null);
    },

    /** Marks every row this person sees as seen, keeping the first time each was. */
    async markSeen(userId: string, isAdult: () => Promise<boolean>, launchNowMs: number): Promise<void> {
      if (!before(launchNowMs)) return;
      const ids = (await shownNotices(userId, isAdult))
        .filter(({ row }) => row.noticeSeenAt === null)
        .map(({ row }) => row.id);
      if (ids.length === 0) return;
      await db.playtester.updateMany({
        where: { id: { in: ids }, noticeSeenAt: null },
        data: { noticeSeenAt: now() },
      });
    },

    /**
     * The player's own Remove: the row leaves Your turn, and they stay a playtester. A row of theirs that no longer shows
     * (the maker took them off in another tab) answers done too; someone else's row is "not found".
     */
    async hide(userId: string, rowId: string): Promise<"removed" | "not found"> {
      const mine = await db.playtester.count({ where: { id: rowId, userId } });
      if (mine === 0) return "not found";
      await db.playtester.updateMany({
        where: { id: rowId, userId, state: "in", noticeAt: { not: null }, noticeGoneAt: null },
        data: { noticeGoneAt: now() },
      });
      return "removed";
    },
  };
}
