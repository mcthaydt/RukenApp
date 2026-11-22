import { describe, expect, it } from "vitest";
import { wishlistCountWords } from "../../../src/features/launch/words.ts";

// The maker's wishlist number in words (wishlist spec, "What a maker sees").
describe("wishlistCountWords", () => {
  it("says none plainly before launch", () => {
    expect(wishlistCountWords(0, true)).toBe("No wishlists yet");
  });
  it("says one person and many people", () => {
    expect(wishlistCountWords(1, true)).toBe("Wishlisted by 1 person");
    expect(wishlistCountWords(1200, true)).toBe("Wishlisted by 1,200 people");
  });
  it("keeps the count after launch as a record of before, and says nothing for none", () => {
    expect(wishlistCountWords(12, false)).toBe("Wishlisted by 12 people before launch");
    expect(wishlistCountWords(0, false)).toBeNull();
  });
});
