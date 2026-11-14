// Sharing out a month's pool (stub: red step).

export interface MemberMonth {
  readonly userId: string;
  readonly contribution: bigint;
  readonly broughtBy: string | null;
  readonly plays: readonly { gameId: string; seconds: number }[];
}

export type PoolOutcome =
  | {
      readonly kind: "shared";
      readonly games: readonly { gameId: string; weight: bigint; amount: bigint }[];
      readonly bringers: readonly { makerUserId: string; weight: bigint; members: number; amount: bigint }[];
      readonly carry: bigint;
    }
  | { readonly kind: "carry"; readonly amount: bigint };

export function allocateMakersPool(
  pool: bigint,
  members: readonly MemberMonth[],
  carriedIn = 0n,
): PoolOutcome {
  throw new Error(
    `not built yet: allocateMakersPool ${String(pool)} ${String(members.length)} ${String(carriedIn)}`,
  );
}
