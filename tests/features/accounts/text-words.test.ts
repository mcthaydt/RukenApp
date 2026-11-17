import { describe, expect, it } from "vitest";
import {
  alreadyText,
  fitText,
  passwordChangedText,
  signInPausedText,
} from "../../../src/features/accounts/text-words.ts";

// The address of the real site is the shortest in use; the test site's is the longest.
const SITES = ["https://ruken.io", "https://ruken.ruken-beta.workers.dev"];

const PLAIN_GSM7 = /^[A-Za-z0-9 .,:;?!'"()\-/@#%&*+=<>_$\n]*$/;

describe("the words of each text", () => {
  it("says each one letter for letter", () => {
    expect(alreadyText("https://ruken.io")).toBe(
      "Ruken: you already have a Ruken account. Sign in, or reset your password: https://ruken.io/sign-in",
    );
    expect(passwordChangedText("https://ruken.io")).toBe(
      "Ruken: your password was changed and we signed you out everywhere. Not you? Choose a new one: https://ruken.io/forgot-password",
    );
    expect(signInPausedText("https://ruken.io")).toBe(
      "Ruken: too many wrong passwords, so sign-in is paused for an hour. Not you? Choose a new password: https://ruken.io/forgot-password",
    );
  });

  describe.each(SITES)("on %s", (site) => {
    it.each([
      ["alreadyText", alreadyText(site)],
      ["passwordChangedText", passwordChangedText(site)],
      ["signInPausedText", signInPausedText(site)],
    ])("%s starts Ruken:, is plain GSM-7, fits one text and holds one link", (_name, text) => {
      expect(text.startsWith("Ruken: ")).toBe(true);
      expect(PLAIN_GSM7.test(text)).toBe(true);
      expect(text.length).toBeLessThanOrEqual(160);
      expect(text.split("http")).toHaveLength(2);
    });
  });
});

describe("fitText", () => {
  const before = "Ruken: ";
  const after = " is out. Play it now: https://ruken.io/g/x";

  it("leaves a name that fits alone", () => {
    expect(fitText(before, "Moon Golf", after)).toBe(`${before}Moon Golf${after}`);
  });

  it("cuts a long name to exactly one text, keeps the whole link, and ends the name in ...", () => {
    const text = fitText(before, "W".repeat(200), after);
    expect(text).toHaveLength(160);
    expect(text.endsWith(after)).toBe(true);
    expect(text).toContain("...");
    expect(text.startsWith(before)).toBe(true);
  });

  it("holds a name with an emoji that survives the cut to 70 characters, since the whole text then takes the wider encoding", () => {
    const text = fitText(before, `😀${"W".repeat(100)}`, after);
    expect(text.length).toBeLessThanOrEqual(70);
    expect(text.endsWith(after)).toBe(true);
    expect(text).toContain("...");
  });

  it("keeps a short emoji name whole when it fits in 70", () => {
    expect(fitText("Ruken: ", "😀", " is out.")).toBe("Ruken: 😀 is out.");
  });

  it("counts a euro sign as two places", () => {
    // 7 + 76 euros (152) + 1 = 160 places is the most that fits; one more euro does not.
    const fits = fitText("Ruken: ", "€".repeat(76), "!");
    expect(fits).toContain("€".repeat(76));
    const cut = fitText("Ruken: ", "€".repeat(77), "!");
    expect(cut).toContain("...");
    expect(cut.endsWith("!")).toBe(true);
  });

  it.each(SITES)("fits with the link of %s", (site) => {
    const text = fitText(before, "W".repeat(200), ` is out. Play it now: ${site}/g/x`);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith(`${site}/g/x`)).toBe(true);
  });
});
