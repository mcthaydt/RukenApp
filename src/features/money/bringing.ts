// Who brought a member (stub: red step).
import type { Period } from "./period.ts";

export interface Join {
  readonly userId: string;
  readonly startedAtMs: number;
  readonly broughtByUserId: string | null;
}

export function bringerOf(joins: readonly Join[], period: Period): string | null {
  throw new Error(`not built yet: bringerOf ${String(joins.length)} ${period}`);
}
