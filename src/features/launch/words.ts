// The maker's one wishlist number, in words (wishlist spec, "What a maker sees"). Counted from stored rows by the
// caller; this only says it.

/**
 * Before launch, how many people want the game, with "No wishlists yet" for none. After launch the count stays as a
 * record of before, and a game nobody wished for says nothing.
 */
export function wishlistCountWords(count: number, beforeLaunch: boolean): string | null {
  if (count === 0) return beforeLaunch ? "No wishlists yet" : null;
  const people = count === 1 ? "1 person" : `${count.toLocaleString("en-US")} people`;
  return beforeLaunch ? `Wishlisted by ${people}` : `Wishlisted by ${people} before launch`;
}
