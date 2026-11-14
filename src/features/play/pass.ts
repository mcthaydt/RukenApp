/** A pass lasts a day. */
export const PASS_LIFE_MS = 24 * 60 * 60 * 1000;

/** A pass is handed out again only while at least four hours are left. */
export const PASS_MIN_LEFT_MS = 4 * 60 * 60 * 1000;

export interface PassClaims {
  id: string;
  game: string;
  pull: string;
  connect: string[];
  expiresAtMs: number;
}

export function newPassId(randomBytes?: (count: number) => Uint8Array): string {
  throw new Error(`not built yet: ${String(randomBytes === undefined)}`);
}

export function makePass(claims: PassClaims, secret: string): string {
  throw new Error(`not built yet: ${claims.id} ${secret}`);
}

export function checkPass(value: string, secret: string, nowMs: number): PassClaims | null {
  throw new Error(`not built yet: ${value} ${secret} ${String(nowMs)}`);
}
