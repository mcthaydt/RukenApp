/**
 * A whole number from 0 to 4,294,967,295 that depends only on the two words: the 32-bit FNV-1a hash of
 * `seed + "\n" + key`. The same words give the same number on every machine, so an order that breaks ties with it can be
 * replayed, and a new seed (a new day) shuffles the ties. It is for spreading things out, never for secrets.
 */
export function seededNumber(seed: string, key: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${seed}\n${key}`)) {
    hash ^= byte;
    // Multiplying by the FNV prime (16777619) in 32 bits: Math.imul keeps the low 32 bits of the product.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
