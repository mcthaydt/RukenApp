import { describe, expect, it } from "vitest";
import {
  alreadyText,
  codeText,
  fitText,
  passwordChangedText,
  placesIn,
  resetCodeText,
  signInPausedText,
  textLimitOf,
} from "../../../src/features/accounts/text-words.ts";

// The site address is BETTER_AUTH_URL. The longest one in use is the test copy's workers.dev address.
const SITES = ["https://ruken.io", "https://ruken.ruken-beta.workers.dev"];

describe("the words of each text", () => {
  it("says each text whole", () => {
    expect(codeText("123456")).toBe(
      "Ruken: your code is 123456. It works for 10 minutes. Don't share it with anyone.",
    );
    expect(alreadyText("https://ruken.io")).toBe(
      "Ruken: you already have a Ruken account. Sign in, or reset your password: https://ruken.io/sign-in",
    );
    expect(resetCodeText("123456")).toBe(
      "Ruken: your code to choose a new password is 123456. It works for 10 minutes. Didn't ask? Ignore this text.",
    );
    expect(passwordChangedText("https://ruken.io")).toBe(
      "Ruken: your password was changed and we signed you out everywhere. Not you? Choose a new one: https://ruken.io/forgot-password",
    );
    expect(signInPausedText("https://ruken.io")).toBe(
      "Ruken: too many wrong passwords, so sign-in is paused for an hour. Not you? Choose a new password: https://ruken.io/forgot-password",
    );
  });

  describe.each(SITES)("with the site %s", (site) => {
    const texts = {
      codeText: codeText("123456"),
      alreadyText: alreadyText(site),
      resetCodeText: resetCodeText("123456"),
      passwordChangedText: passwordChangedText(site),
      signInPausedText: signInPausedText(site),
    };

    it.each(Object.entries(texts))(
      "%s starts Ruken:, is plain GSM-7, fits one text and holds one link at most",
      (_name, text) => {
        expect(text.startsWith("Ruken:")).toBe(true);
        expect(textLimitOf(text)).toBe(160);
        expect(placesIn(text)).toBeLessThanOrEqual(160);
        expect((text.match(/http/g) ?? []).length).toBeLessThanOrEqual(1);
      },
    );
  });
});

describe("placesIn and textLimitOf", () => {
  it("counts a plain text by its letters, with 160 to a text", () => {
    expect(placesIn("Ruken: hi")).toBe(9);
    expect(textLimitOf("Ruken: hi")).toBe(160);
  });

  it("counts the characters GSM-7 spells with two places as two", () => {
    expect(placesIn("€[]{}|^~\\")).toBe(18);
    expect(textLimitOf("€")).toBe(160);
  });

  it("moves a text with anything outside GSM-7 to 70 characters, each counted in 16-bit units", () => {
    expect(textLimitOf("Ruken: 🎮")).toBe(70);
    expect(placesIn("Ruken: 🎮")).toBe(9);
    expect(textLimitOf("Ruken: “quoted”")).toBe(70);
    expect(textLimitOf("Ruken: it's")).toBe(160);
  });
});

describe("fitText", () => {
  const before = "Ruken: ";
  const after = " is out. Play it now: https://ruken.io/g/x";

  it("leaves a name that fits as it is", () => {
    expect(fitText(before, "Moth Garden", after)).toBe(`${before}Moth Garden${after}`);
  });

  it("cuts a name that is too long to exactly one text, ending in ... and keeping the whole link", () => {
    const text = fitText(before, "W".repeat(200), after);

    expect(placesIn(text)).toBe(160);
    expect(text.endsWith(after)).toBe(true);
    expect(text).toContain("...");
    expect(text.startsWith(`${before}WWW`)).toBe(true);
  });

  it("holds a name with an emoji to 70 characters, and still keeps the whole link", () => {
    const text = fitText(before, `🎮${"W".repeat(200)}`, after);

    expect(textLimitOf(text)).toBe(70);
    expect(placesIn(text)).toBeLessThanOrEqual(70);
    expect(text.endsWith(after)).toBe(true);
    expect(text).toContain("...");
  });

  it("never cuts an emoji in half", () => {
    const text = fitText(before, "🎮".repeat(60), after);

    expect(text).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(placesIn(text)).toBeLessThanOrEqual(70);
  });

  it("counts € as two places", () => {
    const text = fitText(before, "€".repeat(200), after);

    expect(textLimitOf(text)).toBe(160);
    expect(placesIn(text)).toBeLessThanOrEqual(160);
    expect(placesIn(text)).toBeGreaterThanOrEqual(158);
    expect(text.endsWith(after)).toBe(true);
  });

  it("keeps the longest name that fits when the link is the longest in use", () => {
    const longAfter = " is out. Play it now: https://ruken.ruken-beta.workers.dev/g/a-very-long-game-name";
    const text = fitText(before, "W".repeat(200), longAfter);

    expect(placesIn(text)).toBe(160);
    expect(text.endsWith(longAfter)).toBe(true);
  });

  it("does not leave a space before the dots", () => {
    const text = fitText(before, `${"W".repeat(100)} ${"V".repeat(100)}`, after);

    expect(text).not.toContain(" ...");
  });
});
