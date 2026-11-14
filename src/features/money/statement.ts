import type { DateText } from "./calendar.ts";
import type { Period } from "./period.ts";

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
  readonly shares: readonly {
    readonly kind: "play" | "bringing";
    readonly game: StatementGame | null;
    readonly amount: bigint;
    readonly seconds: number | null;
    readonly members: number | null;
  }[];
  readonly others: readonly {
    readonly kind: "transfer" | "payout_cost" | "correction";
    readonly key: string;
    readonly amount: bigint;
    readonly payoutId?: string;
    readonly sentOn?: DateText;
    readonly note?: string;
  }[];
  readonly owed: bigint;
}

export function buildStatement(input: StatementInput): {
  document: StatementDocument;
  canonical: string;
  hash: string;
} {
  throw new Error(`not built yet: buildStatement ${input.makerUserId}`);
}
