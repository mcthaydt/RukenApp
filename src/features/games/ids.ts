/** A game's own name on the games' domain and in the bucket: ten characters of a-z and 2-7. */
export const PUBLIC_ID = /^[a-z2-7]{10}$/;

export function newPublicId(randomBytes?: (count: number) => Uint8Array): string {
  throw new Error(`not built yet: ${typeof randomBytes}`);
}

export function slugOf(name: string): string | null {
  throw new Error(`not built yet: ${name}`);
}
