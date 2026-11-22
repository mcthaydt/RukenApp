import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Place } from "../../lib/server/platform.ts";
import type { RateLimiter } from "../../lib/server/rate-limit.ts";

// Computers a maker lets act for them (`npx ruken sign-in`). The terminal asks for a code, the maker presses Yes on
// Ruken, and the terminal collects a key. The key is kept here only as its SHA-256, so a copy of the table opens
// nothing. Everything about who may do what lives in the routes under /api/v1; this file only knows keys and codes.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A code works for ten minutes, and for one Yes. */
export const CODE_LIFETIME_MS = 10 * MINUTE_MS;
/** A key not used for 90 days stops working. */
export const KEY_UNUSED_DAYS = 90;
/** The most computers one maker can have. */
export const MAX_COMPUTERS = 20;
/** The name a computer gives itself is cut to this. */
const NAME_MAX = 60;

const START_PER_ADDRESS = { max: 10, windowMs: HOUR_MS } as const;
const FINISH_PER_CODE = { max: 1, windowMs: 5_000 } as const;
const WRONG_CODES_PER_ADDRESS = { max: 5, windowMs: 10 * MINUTE_MS } as const;
const YES_PER_MAKER = { max: 20, windowMs: HOUR_MS } as const;

export const WORDS = {
  tooManyStarts: "Too many tries. Wait a while and try again.",
  slowDown: "Slow down. Wait 5 seconds and ask again.",
  wrongCode: "That code isn't right. Run `npx ruken sign-in` again.",
  tooManyWrongCodes: "Too many wrong codes. Wait 10 minutes and try again.",
  codeRanOut: "That code ran out. Run `npx ruken sign-in` again.",
  pressedNo: "You pressed No on Ruken. Run `npx ruken sign-in` again if you want to try again.",
  tooManyComputers: "You have 20 computers. Remove one first.",
  tooManyYes: "Too many tries. Wait a while and try again.",
  signInAgain: "Sign in again: npx ruken sign-in",
  somewhere: "somewhere we can't tell",
} as const;

// No I, O, 0 or 1: nobody mistakes one for another when reading a code off a screen.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Four letters, a hyphen, four letters. */
const CODE_SHAPE = /^[A-HJ-NP-Z]{4}-[A-HJ-NP-Z]{4}$/;

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function randomLetters(count: number): string {
  let letters = "";
  while (letters.length < count) {
    // A byte under 240 is spread evenly over 24 letters; the rest are thrown away so no letter is likelier.
    for (const byte of randomBytes(count * 2)) {
      if (byte < 240 && letters.length < count) letters += CODE_LETTERS.charAt(byte % CODE_LETTERS.length);
    }
  }
  return letters;
}

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** 32 random bytes as base32 text: 52 characters. */
function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32.charAt((value << (5 - bits)) & 31);
  return out;
}

export function makeKey(): string {
  return `rk_${base32(randomBytes(32))}`;
}

/** What is typed or pasted, as a code written one way: upper case, with the hyphen. */
export function cleanCode(typed: string): string | null {
  const letters = typed.replace(/[\s-]/g, "").toUpperCase();
  if (letters.length !== 8) return null;
  const code = `${letters.slice(0, 4)}-${letters.slice(4)}`;
  return CODE_SHAPE.test(code) ? code : null;
}

export interface ComputerDeps {
  readonly prisma: PrismaClient;
  readonly clock: Clock;
  readonly limiter: RateLimiter;
}

// ---- Where a request came from ----------------------------------------------------------------------------------

/** A place as words: "Lisbon, Portugal", "Portugal", or "somewhere we can't tell". */
export function placeWords(place: Place): string {
  if (place.country === null && place.city === null) return WORDS.somewhere;
  return [place.city, place.country].filter((part): part is string => part !== null).join(", ");
}

/**
 * The warning shown above the Yes button when the computer asked from one place and the browser answers from another,
 * or null. A place with nothing known on either side never warns: there is nothing to compare.
 */
export function placeWarning(startedFrom: Place, here: Place): string | null {
  const unknown = (place: Place) => place.city === null && place.country === null;
  if (unknown(startedFrom) || unknown(here)) return null;
  const sameCountry = startedFrom.country === here.country;
  // A city is compared only when both sides know one.
  const sameCity = startedFrom.city === null || here.city === null || startedFrom.city === here.city;
  if (sameCountry && sameCity) return null;
  return `This was asked from ${placeWords(startedFrom)}. You're in ${placeWords(here)}. If you didn't just type \`npx ruken sign-in\`, press No.`;
}

function placeOfJson(json: string | null): Place {
  if (json === null) return { city: null, country: null };
  try {
    const parsed = JSON.parse(json) as { city?: unknown; country?: unknown };
    return {
      city: typeof parsed.city === "string" ? parsed.city : null,
      country: typeof parsed.country === "string" ? parsed.country : null,
    };
  } catch {
    return { city: null, country: null };
  }
}

// ---- Signing in --------------------------------------------------------------------------------------------------

export type StartResult =
  | { ok: true; code: string; deviceSecret: string; expiresAt: Date }
  | { ok: false; status: 429; problem: string };

/** Makes a code for a computer that wants in. At most 10 an hour from one address. */
export async function startSignIn(
  deps: ComputerDeps,
  input: { name: string; startedFrom: Place; clientAddress: string },
): Promise<StartResult> {
  const { prisma, clock, limiter } = deps;
  if (!(await limiter.hit(`api:computer-start:${input.clientAddress}`, START_PER_ADDRESS)).allowed) {
    return { ok: false, status: 429, problem: WORDS.tooManyStarts };
  }
  const now = clock.epochMs();
  await deleteOldestExpired(deps, 10);

  const deviceSecret = randomBytes(24).toString("hex");
  const expiresAt = new Date(now + CODE_LIFETIME_MS);
  // Eight letters from 24 collide rarely; a collision tries another code.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${randomLetters(4)}-${randomLetters(4)}`;
    try {
      await prisma.computerSignIn.create({
        data: {
          code,
          deviceSecretHash: sha256(deviceSecret),
          name: input.name.trim().slice(0, NAME_MAX) || "A computer",
          startedFrom: JSON.stringify(input.startedFrom),
          createdAt: new Date(now),
          expiresAt,
        },
      });
      return { ok: true, code, deviceSecret, expiresAt };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("could not make a sign-in code");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function deleteOldestExpired(deps: ComputerDeps, count: number): Promise<void> {
  const old = await deps.prisma.computerSignIn.findMany({
    where: { expiresAt: { lte: new Date(deps.clock.epochMs()) } },
    orderBy: { expiresAt: "asc" },
    take: count,
    select: { id: true },
  });
  if (old.length > 0) {
    await deps.prisma.computerSignIn.deleteMany({ where: { id: { in: old.map((row) => row.id) } } });
  }
}

/** What the Yes screen shows about a code. */
export interface SignInAsked {
  code: string;
  name: string;
  startedFrom: Place;
  /** Whole seconds since the computer asked. */
  secondsAgo: number;
}

export type LookResult =
  | { found: true; asked: SignInAsked }
  | { found: false; reason: "wrong" | "ran_out" | "answered" | "too_many_wrong" };

/**
 * Looks up the code a maker typed or followed a link with. A wrong code is counted against the address, and 5 wrong ones
 * refuse it for 10 minutes. A code the computer has already been answered on cannot be answered twice.
 */
export async function lookAtSignIn(
  deps: ComputerDeps,
  typed: string,
  clientAddress: string,
): Promise<LookResult> {
  const { prisma, clock, limiter } = deps;
  const wrongKey = `api:computer-wrong-code:${clientAddress}`;
  if ((await limiter.count(wrongKey, WRONG_CODES_PER_ADDRESS)) >= WRONG_CODES_PER_ADDRESS.max) {
    return { found: false, reason: "too_many_wrong" };
  }
  const code = cleanCode(typed);
  const row = code === null ? null : await prisma.computerSignIn.findUnique({ where: { code } });
  if (row === null) {
    await limiter.hit(wrongKey, WRONG_CODES_PER_ADDRESS);
    return { found: false, reason: "wrong" };
  }
  const now = clock.epochMs();
  if (row.expiresAt.getTime() <= now) {
    await prisma.computerSignIn.delete({ where: { id: row.id } }).catch(() => undefined);
    return { found: false, reason: "ran_out" };
  }
  if (row.answer !== null) return { found: false, reason: "answered" };
  return {
    found: true,
    asked: {
      code: row.code,
      name: row.name,
      startedFrom: placeOfJson(row.startedFrom),
      secondsAgo: Math.max(0, Math.floor((now - row.createdAt.getTime()) / 1000)),
    },
  };
}

/** The maker's computers: keys made, and Yes answers whose terminal has not collected its key yet. */
async function computersCounted(deps: ComputerDeps, userId: string): Promise<number> {
  const { prisma, clock } = deps;
  const [keys, coming] = await Promise.all([
    prisma.computerKey.count({ where: { userId } }),
    prisma.computerSignIn.count({
      where: { userId, answer: "yes", expiresAt: { gt: new Date(clock.epochMs()) } },
    }),
  ]);
  return keys + coming;
}

export type AnswerResult = "yes" | "no" | "wrong" | "ran_out" | "answered" | "too_many_computers" | "limited";

/** The maker presses Yes or No on a code. Only the first answer counts. */
export async function answerSignIn(
  deps: ComputerDeps,
  input: { code: string; userId: string; yes: boolean },
): Promise<AnswerResult> {
  const { prisma, clock, limiter } = deps;
  if (!(await limiter.hit(`api:computer-yes:${input.userId}`, YES_PER_MAKER)).allowed) return "limited";
  const code = cleanCode(input.code);
  const row = code === null ? null : await prisma.computerSignIn.findUnique({ where: { code } });
  if (row === null) return "wrong";
  if (row.expiresAt.getTime() <= clock.epochMs()) return "ran_out";
  if (row.answer !== null) return "answered";
  // A Yes that has not been collected yet is a computer on its way, so it counts too.
  if (input.yes && (await computersCounted(deps, input.userId)) >= MAX_COMPUTERS) return "too_many_computers";
  // Only a code nobody has answered: two presses at once let one in.
  const answered = await prisma.computerSignIn.updateMany({
    where: { id: row.id, answer: null },
    data: { userId: input.userId, answer: input.yes ? "yes" : "no" },
  });
  if (answered.count === 0) return "answered";
  return input.yes ? "yes" : "no";
}

export type FinishResult =
  | { status: "waiting" }
  | { status: "slow"; problem: string }
  | { status: "gone"; problem: string }
  | { status: "no"; problem: string }
  | { status: "yes"; key: string; userId: string };

/** The terminal asks whether Yes was pressed. It needs the code and the secret only it holds. */
export async function finishSignIn(
  deps: ComputerDeps,
  input: { code: string; deviceSecret: string },
): Promise<FinishResult> {
  const { prisma, clock, limiter } = deps;
  const code = cleanCode(input.code);
  if (code === null) return { status: "gone", problem: WORDS.wrongCode };
  if (!(await limiter.hit(`api:computer-finish:${code}`, FINISH_PER_CODE)).allowed) {
    return { status: "slow", problem: WORDS.slowDown };
  }
  const row = await prisma.computerSignIn.findUnique({ where: { code } });
  // The wrong secret is answered as a wrong code, so knowing a code alone says nothing.
  if (row === null || row.deviceSecretHash !== sha256(input.deviceSecret)) {
    return { status: "gone", problem: WORDS.wrongCode };
  }
  if (row.expiresAt.getTime() <= clock.epochMs()) {
    await prisma.computerSignIn.delete({ where: { id: row.id } }).catch(() => undefined);
    return { status: "gone", problem: WORDS.codeRanOut };
  }
  if (row.answer === null) return { status: "waiting" };
  if (row.answer === "no" || row.userId === null) {
    await prisma.computerSignIn.delete({ where: { id: row.id } }).catch(() => undefined);
    return { status: "no", problem: WORDS.pressedNo };
  }

  // One finish takes the key: the row is deleted in the same step, so a second finish finds nothing.
  const userId = row.userId;
  // Checked again here: twenty keys is the most, whatever Yes answers were given while there was room.
  if ((await prisma.computerKey.count({ where: { userId } })) >= MAX_COMPUTERS) {
    await prisma.computerSignIn.delete({ where: { id: row.id } }).catch(() => undefined);
    return { status: "no", problem: WORDS.tooManyComputers };
  }
  const key = makeKey();
  const taken = await prisma.computerSignIn.deleteMany({ where: { id: row.id, answer: "yes" } });
  if (taken.count === 0) return { status: "gone", problem: WORDS.wrongCode };
  const now = new Date(clock.epochMs());
  await prisma.computerKey.create({
    data: { userId, name: row.name, keyHash: sha256(key), createdAt: now, lastUsedAt: now },
  });
  return { status: "yes", key, userId };
}

// ---- Reading a key -----------------------------------------------------------------------------------------------

/** Who a request with this `Authorization` header is: the maker and the key's id, or null. */
export async function readKey(
  deps: ComputerDeps,
  authorization: string | null,
): Promise<{ userId: string; keyId: string } | null> {
  const key = /^Bearer (rk_[a-z2-7]{52})$/.exec(authorization ?? "")?.[1];
  if (key === undefined) return null;
  const now = deps.clock.epochMs();
  const row = await deps.prisma.computerKey.findUnique({
    where: { keyHash: sha256(key) },
    select: { id: true, userId: true, lastUsedAt: true, user: { select: { status: true } } },
  });
  if (row === null) return null;
  // The same test a session gets (handle.ts): only an active account. Using a key never restores a deleted account.
  if (row.user.status !== "active") return null;
  if (row.lastUsedAt.getTime() < now - KEY_UNUSED_DAYS * DAY_MS) return null;
  // Written at most once an hour: a busy computer does not write on every request.
  if (row.lastUsedAt.getTime() < now - HOUR_MS) {
    await deps.prisma.computerKey.updateMany({
      where: { id: row.id, lastUsedAt: { lt: new Date(now - HOUR_MS) } },
      data: { lastUsedAt: new Date(now) },
    });
  }
  return { userId: row.userId, keyId: row.id };
}

// ---- Your computers ----------------------------------------------------------------------------------------------

export interface ComputerRow {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export function computersOf(deps: ComputerDeps, userId: string): Promise<ComputerRow[]> {
  return deps.prisma.computerKey.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
  });
}

/** Renames one of the maker's own computers. Returns false when it is not theirs or the name is empty. */
export async function renameComputer(
  deps: ComputerDeps,
  userId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const cleaned = name.trim().slice(0, NAME_MAX);
  if (cleaned === "") return false;
  const done = await deps.prisma.computerKey.updateMany({ where: { id, userId }, data: { name: cleaned } });
  return done.count > 0;
}

/** Removes one of the maker's own computers. It stops working on its next request. */
export async function removeComputer(deps: ComputerDeps, userId: string, id: string): Promise<boolean> {
  const done = await deps.prisma.computerKey.deleteMany({ where: { id, userId } });
  return done.count > 0;
}

/** Removes every computer of a maker: a changed or reset password, or a deleted account. */
export async function removeAllComputers(
  prisma: Pick<PrismaClient, "computerKey" | "computerSignIn">,
  userId: string,
): Promise<void> {
  await prisma.computerKey.deleteMany({ where: { userId } });
  // A Yes given before this is no way to collect a key after it.
  await prisma.computerSignIn.deleteMany({ where: { userId } });
}
