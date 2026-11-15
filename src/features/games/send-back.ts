import type { GamePart } from "../../lib/server/db.ts";

// Not built yet: the stubs keep the red run's failures to the tests that name them.
export interface SendBackReason {
  part: GamePart;
  code: string;
  staff: string;
  maker: string;
}
export function reasonsFor(part: GamePart): SendBackReason[] {
  void part;
  return [];
}
export function isReasonFor(part: GamePart, code: string): boolean {
  void [part, code];
  return false;
}
export function makerWords(part: GamePart, code: string, note: string | null, gameName: string): string {
  void [part, code, note, gameName];
  return "";
}
export function partTitle(part: GamePart, gameName: string): string {
  void [part, gameName];
  return "";
}
export function partNoun(part: GamePart): string {
  void part;
  return "";
}
