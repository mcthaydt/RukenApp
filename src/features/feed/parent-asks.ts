import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Texter } from "../../lib/server/text.ts";
import { hashNumber, isAdultOn, typedNumber } from "../accounts/accounts.ts";

// A parent's yes (learned feed spec 6.5, unit I): a teen asks a parent, Ruken texts the parent a link, and the parent's
// Yes turns on the teen's learning feed until the parent turns it off. The link's secret part is the one-time code, so
// the parent never types one; only its hash is kept, and the parent's number only as a keyed hash.

/** How long an unanswered ask stays open. */
export const ASK_DAYS = 5;
/** How many texts a teen may send parents in a day (a rolling 24 hours). */
export const TEXTS_A_DAY = 3;

/**
 * How many asks one phone number may be texted in a day, from every teen together. The mechanism is public; the
 * deploy's number is not (the owner, 2026-11-22: spam numbers go private). The deploy sets it in the Worker secret
 * PARENT_ASK_LIMITS; this stand-in, deliberately loose, is for dev, the journeys and any moment the secret is missing.
 */
export interface ParentAskLimits {
  perNumberADay: number;
}

export const STAND_IN_PARENT_ASK_LIMITS: ParentAskLimits = { perNumberADay: 10 };

/** Reads PARENT_ASK_LIMITS; anything missing or out of shape is the stand-in, and one line is logged without values. */
export function readParentAskLimits(raw: string | undefined, log: (line: string) => void): ParentAskLimits {
  if (raw === undefined || raw === "") return STAND_IN_PARENT_ASK_LIMITS;
  try {
    const parsed: unknown = JSON.parse(raw);
    const perNumberADay = (parsed as { perNumberADay?: unknown } | null)?.perNumberADay;
    if (Number.isSafeInteger(perNumberADay) && (perNumberADay as number) >= 1)
      return { perNumberADay: perNumberADay as number };
  } catch {
    // Not JSON: the stand-in, as below.
  }
  log("PARENT_ASK_LIMITS is not in shape: the stand-in limits are used");
  return STAND_IN_PARENT_ASK_LIMITS;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_LONGEST = 30;

/**
 * What Your feed shows a teen whose feed does not learn: nothing asked yet, an ask waiting for the parent, or a yes
 * that waits for `teenPersonal`.
 */
export type AskState = "none" | "waiting" | "yes";

export type AskOutcome =
  | "texted"
  | "bad-name"
  | "bad-number"
  | "own-number"
  | "teen-number"
  | "said-no"
  | "number-busy"
  | "waiting"
  | "has-yes"
  | "adult"
  | "too-many"
  | "not-sent";

/** What the parent's link shows. `held` says whether a yes turns the feed on now (`teenPersonal`). */
export type ParentPage =
  { kind: "open" } | { kind: "yes"; held: boolean } | { kind: "no" } | { kind: "off" } | { kind: "ended" };

export type ParentChoice = "yes" | "no" | "off";

export interface ParentAsksDeps {
  db: PrismaClient;
  clock: Clock;
  /** The Texter, and the server's secret for the keyed hash of the parent's number. */
  texting: () => { texter: Texter; secret: string };
  /** FEED_PUBLIC's `teenPersonal`: off, a yes is kept but the feed stays calm. */
  teenPersonal: () => boolean;
  /** The private per-number limit (PARENT_ASK_LIMITS); left out, the stand-in. */
  limits?: () => ParentAskLimits;
}

export type ParentAsks = ReturnType<typeof createParentAsks>;

const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex");

/** The text the parent gets. The name is the teen's own words, checked by `nameOf`. */
export function parentText(name: string, link: string): string {
  return `Your teen ${name} asked for a Ruken feed that learns what they like. Say yes or no: ${link}`;
}

/**
 * The first name as typed, tidied, or null when it could not be one: letters, with spaces, dots, dashes and apostrophes
 * between them. A link or a number cannot get into the text this way.
 */
export function nameOf(typed: string): string | null {
  const name = typed.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > NAME_LONGEST) return null;
  return /^\p{L}[\p{L}\p{M} '.-]*$/u.test(name) ? name : null;
}

/** Whether a parent's yes holds for this person now. */
export async function holdsYes(db: PrismaClient, teenUserId: string): Promise<boolean> {
  return (await db.parentAsk.count({ where: { teenUserId, answer: "yes", revokedAt: null } })) > 0;
}

export function createParentAsks(deps: ParentAsksDeps) {
  const { db, clock } = deps;
  const now = () => new Date(clock.epochMs());
  const openSince = () => new Date(clock.epochMs() - ASK_DAYS * DAY_MS);

  /** The open ask's filter: nobody answered or ended it, and it is under five days old. */
  const open = (teenUserId: string) => ({
    teenUserId,
    answer: null,
    revokedAt: null,
    askedAt: { gt: openSince() },
  });

  function pageOfRow(row: {
    askedAt: Date;
    answer: "yes" | "no" | null;
    revokedAt: Date | null;
  }): ParentPage {
    if (row.answer === "yes")
      return row.revokedAt === null ? { kind: "yes", held: deps.teenPersonal() } : { kind: "off" };
    if (row.answer === "no") return { kind: "no" };
    if (row.revokedAt !== null || row.askedAt <= openSince()) return { kind: "ended" };
    return { kind: "open" };
  }

  return {
    async stateOf(teenUserId: string): Promise<AskState> {
      if (await holdsYes(db, teenUserId)) return "yes";
      return (await db.parentAsk.count({ where: open(teenUserId) })) > 0 ? "waiting" : "none";
    },

    /**
     * Texts the parent a link, once the name and number are right and the teen has no ask open, no yes holding and
     * texts left today. The ask is kept before the text goes, so two presses at once cannot both text; a text that
     * could not go ends its ask.
     */
    async ask(
      teenUserId: string,
      typed: { name: string; country: string; phone: string },
      origin: string,
    ): Promise<AskOutcome> {
      const name = nameOf(typed.name);
      if (name === null) return "bad-name";
      const number = typedNumber(typed.country, typed.phone);
      if (number === null) return "bad-number";
      const token = randomBytes(32).toString("base64url");

      const kept = await db.$transaction(async (tx) => {
        // The teen's row is locked first, so two asks at once are counted one after the other.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${teenUserId} FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: teenUserId }, select: { adultOn: true } });
        if (user === null || isAdultOn(user.adultOn, clock)) return "adult" as const;
        if ((await tx.parentAsk.count({ where: { teenUserId, answer: "yes", revokedAt: null } })) > 0)
          return "has-yes" as const;
        if ((await tx.parentAsk.count({ where: open(teenUserId) })) > 0) return "waiting" as const;
        const today = await tx.parentAsk.count({
          where: { teenUserId, askedAt: { gt: new Date(clock.epochMs() - DAY_MS) } },
        });
        if (today >= TEXTS_A_DAY) return "too-many" as const;
        // A parent's number, never a teen's: not the teen's own, and not one on any account that is not a known adult's.
        const holder = await tx.user.findUnique({
          where: { phoneNumber: number },
          select: { id: true, adultOn: true },
        });
        if (holder?.id === teenUserId) return "own-number" as const;
        if (holder !== null && !isAdultOn(holder.adultOn, clock)) return "teen-number" as const;
        const phoneHash = hashNumber(number, deps.texting().secret);
        // A parent who said no is not texted again by this teen.
        if ((await tx.parentAsk.count({ where: { teenUserId, phoneHash, answer: "no" } })) > 0)
          return "said-no" as const;
        // One number is texted only so often a day, from every teen together, so nobody can flood a stranger's phone.
        const toNumber = await tx.parentAsk.count({
          where: { phoneHash, askedAt: { gt: new Date(clock.epochMs() - DAY_MS) } },
        });
        if (toNumber >= (deps.limits?.() ?? STAND_IN_PARENT_ASK_LIMITS).perNumberADay)
          return "number-busy" as const;
        // An ask that ran out of days is ended for good, so a teen only ever has one ask open.
        await tx.parentAsk.updateMany({
          where: { teenUserId, answer: null, revokedAt: null },
          data: { revokedAt: now() },
        });
        const row = await tx.parentAsk.create({
          data: {
            teenUserId,
            phoneHash,
            tokenHash: hashOf(token),
            askedAt: now(),
          },
          select: { id: true },
        });
        return row;
      });
      if (typeof kept === "string") return kept;

      let sent = false;
      try {
        const result = await deps.texting().texter.send({
          to: number,
          line: "account",
          body: parentText(name, `${origin}/parent/${token}`),
        });
        sent = result.sent;
      } catch (error) {
        console.error(
          `parent's yes: the text did not go: ${error instanceof Error ? error.name : "unknown error"}`,
        );
      }
      if (sent) return "texted";
      await db.parentAsk.update({ where: { id: kept.id }, data: { revokedAt: now() } });
      return "not-sent";
    },

    /** Ends the teen's open ask, if there is one: its link then says it has ended. */
    async cancel(teenUserId: string): Promise<void> {
      await db.parentAsk.updateMany({ where: open(teenUserId), data: { revokedAt: now() } });
    },

    /** What the parent's link shows. A link Ruken never made shows the same as an ended one. */
    async pageOf(token: string): Promise<ParentPage> {
      const row = await db.parentAsk.findUnique({
        where: { tokenHash: hashOf(token) },
        select: { askedAt: true, answer: true, revokedAt: true },
      });
      return row === null ? { kind: "ended" } : pageOfRow(row);
    },

    /**
     * The parent's press. Yes and No answer an open ask; Turn it off ends a yes, and what the feed learned from the teen
     * goes with it, so turning it on again starts fresh. Any other press changes nothing and shows the link as it is.
     */
    async answer(token: string, choice: ParentChoice): Promise<ParentPage> {
      return db.$transaction(async (tx) => {
        const found = await tx.parentAsk.findUnique({
          where: { tokenHash: hashOf(token) },
          select: { id: true },
        });
        if (found === null) return { kind: "ended" } as const;
        await tx.$queryRaw`SELECT "id" FROM "ParentAsk" WHERE "id" = ${found.id} FOR UPDATE`;
        const row = await tx.parentAsk.findUniqueOrThrow({
          where: { id: found.id },
          select: { teenUserId: true, askedAt: true, answer: true, revokedAt: true },
        });
        const page = pageOfRow(row);
        if (page.kind === "open" && choice !== "off") {
          const answered = { answer: choice, answeredAt: now() };
          await tx.parentAsk.update({ where: { id: found.id }, data: answered });
          return pageOfRow({ ...row, ...answered });
        }
        if (page.kind === "yes" && choice === "off") {
          const at = now();
          await tx.parentAsk.update({ where: { id: found.id }, data: { revokedAt: at } });
          await tx.feedTaste.deleteMany({ where: { userId: row.teenUserId } });
          await tx.goodPickAsked.deleteMany({ where: { userId: row.teenUserId } });
          await tx.user.update({ where: { id: row.teenUserId }, data: { feedResetAt: at } });
          return { kind: "off" } as const;
        }
        return page;
      });
    },
  };
}
