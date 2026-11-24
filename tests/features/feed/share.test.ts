import { describe, expect, it } from "vitest";
import { copyLink, shareByPhone, shareTargets } from "../../../src/features/feed/share.ts";

// The share sheet's plain parts: the apps' addresses, the clipboard and the phone's own sheet, with stand-in tools.

const link = { title: "Floor & Fifty?", url: "https://ruken.io/g/floor-fifty" };

describe("shareTargets", () => {
  it("offers Text, WhatsApp, Email, X and Facebook, in that order", () => {
    expect(shareTargets(link).map((target) => target.words)).toEqual(["Text", "WhatsApp", "Email", "X", "Facebook"]);
  });

  it("puts the game's whole address in every app's link, safely written", () => {
    for (const target of shareTargets(link)) {
      const decoded = decodeURIComponent(target.href);
      expect(decoded, target.words).toContain(link.url);
      // A name's & or ? never breaks the app's address.
      expect(target.href, target.words).not.toContain("Floor & Fifty?");
    }
  });

  it("writes the game's name into the message where the app takes words", () => {
    const text = shareTargets(link).find((target) => target.key === "text");
    expect(decodeURIComponent(text?.href ?? "")).toBe(`sms:?&body=Play Floor & Fifty? on Ruken ${link.url}`);
  });
});

describe("copyLink", () => {
  it("copies the link", async () => {
    const copied: string[] = [];
    expect(await copyLink({ copy: (text) => Promise.resolve(void copied.push(text)) }, link.url)).toBe("copied");
    expect(copied).toEqual([link.url]);
  });

  it("asks for a copy by hand where the clipboard refuses or is missing", async () => {
    expect(await copyLink({ copy: () => Promise.reject(new Error("not allowed")) }, link.url)).toBe("manual");
    expect(await copyLink({}, link.url)).toBe("manual");
  });
});

describe("shareByPhone", () => {
  it("hands the link to the phone's sheet", async () => {
    const shared: unknown[] = [];
    expect(await shareByPhone({ share: (data) => Promise.resolve(void shared.push(data)) }, link)).toBe("shared");
    expect(shared).toEqual([link]);
  });

  it("tells a person closing the sheet from a broken sheet", async () => {
    const closes = () => Promise.reject(new DOMException("closed", "AbortError"));
    expect(await shareByPhone({ share: closes }, link)).toBe("closed");
    expect(await shareByPhone({ share: () => Promise.reject(new Error("no sheet")) }, link)).toBe("failed");
    expect(await shareByPhone({}, link)).toBe("failed");
  });
});
