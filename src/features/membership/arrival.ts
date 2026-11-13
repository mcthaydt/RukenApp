// STUB (red push)
export interface Arrival {
  readonly makerUserId: string;
  readonly path: string;
  readonly atMs: number;
}

export const ARRIVAL_COOKIE = "";

export const ARRIVAL_MAX_AGE_SECONDS = 0;

export function sealArrival(arrival: Arrival, secret: string): string {
  throw new Error(`not built yet ${typeof arrival} ${typeof secret}`);
}

export function openArrival(value: string | undefined, secret: string): Arrival | null {
  throw new Error(`not built yet ${typeof value} ${typeof secret}`);
}
