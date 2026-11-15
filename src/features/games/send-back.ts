import type { GamePart } from "../../lib/server/db.ts";

// Not built yet: each stub throws, so the red run fails in the tests that name them and nowhere else.
export interface SendBackReason {
  part: GamePart;
  code: string;
  staff: string;
  maker: string;
}
export function reasonsFor(part: GamePart): SendBackReason[] {
  throw new Error(`not built yet: reasonsFor ${part}`);
}
export function isReasonFor(part: GamePart, code: string): boolean {
  throw new Error(`not built yet: isReasonFor ${part} ${code}`);
}
export function makerWords(part: GamePart, code: string, note: string | null, gameName: string): string {
  throw new Error(`not built yet: makerWords ${part} ${code} ${note ?? ""} ${gameName}`);
}
export function partTitle(part: GamePart, gameName: string): string {
  throw new Error(`not built yet: partTitle ${part} ${gameName}`);
}
export function partNoun(part: GamePart): string {
  throw new Error(`not built yet: partNoun ${part}`);
}
