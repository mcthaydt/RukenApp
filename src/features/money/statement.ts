import { createHash } from "node:crypto";
import type { DateText } from "./calendar.ts";
import { canonicalJson } from "./canonical-json.ts";
import type { Period } from "./period.ts";

/**
 * A maker's statement for one month. Pure: the same input always gives the same bytes, so a stored statement can prove it
 * never changed. It reads as a sum: what stood before, plus what the maker earned, less what was sent, is what they are
 * owed.
 */

/** A game as a statement names it, copied in when the month is made final so a later rename leaves the statement alone. */
export interface StatementGame {
  readonly slug: string;
  readonly name: string;
}

export type StatementLineDoc = { readonly ref: string; readonly amount: bigint } & (
  | { readonly source: "play"; readonly game: StatementGame; readonly minutes: number }
  | { readonly source: "bringing"; readonly members: number }
  | { readonly source: "transfer"; readonly payoutId: string; readonly sentOn: DateText }
  | { readonly source: "payout_cost"; readonly payoutId: string }
  | { readonly source: "correction"; readonly note: string }
);

export interface StatementDocument {
  readonly period: Period;
  readonly finalAt: string;
  readonly lines: readonly StatementLineDoc[];
  /**
   * `earned` is the play, bringing and correction lines added up; `sent` the transfer and payout cost lines added up
   * (zero or less); `owed` the maker's balance after every entry up to and including the month; `broughtForward` is what
   * stood before this month's lines, so `broughtForward + earned + sent` is always `owed`.
   */
  readonly totals: {
    readonly earned: bigint;
    readonly sent: bigint;
    readonly broughtForward: bigint;
    readonly owed: bigint;
  };
}

export interface StatementInput {
  readonly makerUserId: string;
  readonly period: Period;
  readonly finalAt: string;
  /** The month's pool shares for the maker; a game's name and address are copied in. */
  readonly shares: readonly {
    readonly kind: "play" | "bringing";
    readonly game: StatementGame | null;
    readonly amount: bigint;
    readonly seconds: number | null;
    readonly members: number | null;
  }[];
  /** Every other line of the month, each taking money off (below zero) or adding it (above), by the entry's key. */
  readonly others: readonly {
    readonly kind: "transfer" | "payout_cost" | "correction";
    readonly key: string;
    readonly amount: bigint;
    readonly payoutId?: string;
    readonly sentOn?: DateText;
    readonly note?: string;
  }[];
  /** What the maker is owed after every entry up to and including the month. */
  readonly owed: bigint;
}

/**
 * One `play` line for each game, by the game's name (its minutes are the seconds divided by 60, rounded down); one
 * `bringing` line when there is any; then corrections; then each payout's `transfer` (what reached the bank) and its
 * `payout_cost` (what was held back for Stripe's charge), each by key.
 */
export function buildStatement(input: StatementInput): {
  document: StatementDocument;
  canonical: string;
  hash: string;
} {
  const lines = [
    ...playLines(input),
    ...bringingLines(input),
    ...correctionLines(input),
    ...payoutLines(input),
  ];

  let earned = 0n;
  let sent = 0n;
  for (const line of lines) {
    if (line.source === "transfer" || line.source === "payout_cost") sent += line.amount;
    else earned += line.amount;
  }
  const document: StatementDocument = {
    period: input.period,
    finalAt: input.finalAt,
    lines,
    totals: { earned, sent, broughtForward: input.owed - earned - sent, owed: input.owed },
  };
  const canonical = canonicalJson(document);
  return { document, canonical, hash: createHash("sha256").update(canonical).digest("hex") };
}

function playLines(input: StatementInput): StatementLineDoc[] {
  const byGame = new Map<string, { game: StatementGame; amount: bigint; seconds: number }>();
  for (const share of input.shares) {
    if (share.kind !== "play") continue;
    if (share.game === null || share.seconds === null) {
      throw new RangeError("A play share names its game and its seconds");
    }
    const sofar = byGame.get(share.game.slug) ?? { game: share.game, amount: 0n, seconds: 0 };
    byGame.set(share.game.slug, {
      game: sofar.game,
      amount: sofar.amount + share.amount,
      seconds: sofar.seconds + share.seconds,
    });
  }
  return [...byGame.values()]
    .sort((a, b) => compareText(a.game.name, b.game.name) || compareText(a.game.slug, b.game.slug))
    .map(({ game, amount, seconds }) => ({
      ref: `play:${game.slug}`,
      source: "play",
      amount,
      game,
      minutes: Math.floor(seconds / 60),
    }));
}

/** One line for all the members a maker was paid a bringing bonus for. */
function bringingLines(input: StatementInput): StatementLineDoc[] {
  let amount = 0n;
  let members = 0;
  let any = false;
  for (const share of input.shares) {
    if (share.kind !== "bringing") continue;
    if (share.members === null) throw new RangeError("A bringing share names its members");
    any = true;
    amount += share.amount;
    members += share.members;
  }
  return any ? [{ ref: "bringing", source: "bringing", amount, members }] : [];
}

function correctionLines(input: StatementInput): StatementLineDoc[] {
  return input.others
    .filter((other) => other.kind === "correction")
    .sort((a, b) => compareText(a.key, b.key))
    .map((other) => ({
      ref: `correction:${other.key}`,
      source: "correction",
      amount: other.amount,
      note: other.note ?? "Correction",
    }));
}

/** Each payout in turn, by key: what reached the maker's bank, then what was held back for Stripe's charge. */
function payoutLines(input: StatementInput): StatementLineDoc[] {
  const sentLines = input.others.filter((other) => other.kind === "transfer" || other.kind === "payout_cost");
  const keys = [...new Set(sentLines.map((other) => other.key))].sort(compareText);
  const lines: StatementLineDoc[] = [];
  for (const key of keys) {
    const transfer = sentLines.find((other) => other.key === key && other.kind === "transfer");
    if (transfer !== undefined) {
      if (transfer.payoutId === undefined) throw new RangeError(`The transfer line "${key}" names no payout`);
      if (transfer.sentOn === undefined)
        throw new RangeError(`The transfer line "${key}" has no day it was sent`);
      lines.push({
        ref: `transfer:${key}`,
        source: "transfer",
        amount: transfer.amount,
        payoutId: transfer.payoutId,
        sentOn: transfer.sentOn,
      });
    }
    const cost = sentLines.find((other) => other.key === key && other.kind === "payout_cost");
    if (cost !== undefined) {
      if (cost.payoutId === undefined) throw new RangeError(`The payout cost line "${key}" names no payout`);
      lines.push({
        ref: `payout_cost:${key}`,
        source: "payout_cost",
        amount: cost.amount,
        payoutId: cost.payoutId,
      });
    }
  }
  return lines;
}

/** Plain code-unit order: the same on every machine, unlike a locale's. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
