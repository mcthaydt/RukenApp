import { describe, expect, it } from "vitest";
import {
  cleanLinkUrl,
  linkProblem,
  moveLink,
  siteNameOf,
  SOCIAL_SITES,
  socialSiteOf,
} from "../../../src/features/pages/links.ts";

describe("the address of a link", () => {
  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:pw@example.com",
    "https://localhost",
    "example.com",
    "",
    "https://" + "a".repeat(500) + ".com",
  ])("refuses %j", (url) => {
    expect(cleanLinkUrl(url)).toBeNull();
  });

  it("keeps a good address, as the browser reads it", () => {
    expect(cleanLinkUrl("  https://store.steampowered.com/app/1/My_Game/?x=1 ")).toBe(
      "https://store.steampowered.com/app/1/My_Game/?x=1",
    );
  });

  // `new URL` is more forgiving than the database's rule (it starts with lower-case `https://`) and than a
  // redirect (it needs a header with no control character). Keeping the address it read, not the one typed, means
  // whatever passes here is also accepted by both.
  it.each([
    ["HTTPS://example.com", "https://example.com/"],
    ["https:\\\\example.com", "https://example.com/"],
    ["https:example.com", "https://example.com/"],
    ["https://exa\nmple.com", "https://example.com/"],
    ["https://example.com/a\tb", "https://example.com/ab"],
    ["https://example.com/日本", "https://example.com/%E6%97%A5%E6%9C%AC"],
  ])("keeps %j as %j, which the database and a redirect both take", (typed, kept) => {
    expect(cleanLinkUrl(typed)).toBe(kept);
  });

  it("holds only characters a redirect's header can carry, whatever was typed", () => {
    const kept = cleanLinkUrl("https://bücher.example/ü?q=ä b");
    expect(kept).toMatch(/^https:\/\/[\x21-\x7e]+$/);
  });

  it("refuses an address that is short as typed and long as kept", () => {
    // Each character below becomes nine once the browser writes it out.
    expect(cleanLinkUrl(`https://example.com/${"日".repeat(60)}`)).toBeNull();
  });
});

describe("what is wrong with a link", () => {
  it.each([
    [{ title: " ", url: "https://a.com" }, "Give the link a name."],
    [{ title: "a".repeat(61), url: "https://a.com" }, "A link's name can be up to 60 characters."],
    [{ title: "Steam", url: "http://a.com" }, "A link starts with https://"],
    [{ title: "Steam", url: `https://a.com/${"a".repeat(500)}` }, "That address is too long."],
    [{ title: "Steam", url: `https://example.com/${"日".repeat(60)}` }, "That address is too long."],
  ])("says what is wrong with %j", (input, words) => {
    expect(linkProblem(input)).toBe(words);
  });

  it("says nothing about a good link", () => {
    expect(linkProblem({ title: "Steam", url: "https://store.steampowered.com/app/1" })).toBeNull();
  });
});

describe("where a game somewhere else lives", () => {
  it.each([
    ["https://store.steampowered.com/app/1", "Steam"],
    ["https://maker.itch.io/game", "itch.io"],
    ["https://itch.io/games", "itch.io"],
    ["https://play.google.com/store/apps/details?id=a", "Google Play"],
    ["https://apps.apple.com/us/app/a/id1", "the App Store"],
    ["https://store.epicgames.com/en-US/p/a", "Epic Games"],
    ["https://www.gog.com/game/a", "GOG"],
    ["https://gog.com/game/a", "GOG"],
    ["https://www.example.com/x", "example.com"],
  ])("%j is on %s", (url, name) => {
    expect(siteNameOf(url)).toBe(name);
  });
});

describe("moving a link", () => {
  it("moves a link up and down, and leaves the ends alone", () => {
    expect(moveLink(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveLink(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveLink(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveLink(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(moveLink(["a", "b", "c"], "x", "up")).toEqual(["a", "b", "c"]);
  });

  it("does not change the list it was given", () => {
    const ids = ["a", "b"];
    moveLink(ids, "b", "up");
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("the sites that have an icon", () => {
  it.each([
    ["https://www.youtube.com/@floorfifty", "youtube", "YouTube"],
    ["https://youtu.be/abc", "youtube", "YouTube"],
    ["https://twitch.tv/maker", "twitch", "Twitch"],
    ["https://discord.gg/abc123", "discord", "Discord"],
    ["https://discord.com/invite/abc123", "discord", "Discord"],
    ["https://x.com/maker", "x", "X"],
    ["https://twitter.com/maker", "x", "X"],
    ["https://bsky.app/profile/maker.bsky.social", "bluesky", "Bluesky"],
    ["https://www.instagram.com/maker", "instagram", "Instagram"],
    ["https://www.tiktok.com/@maker", "tiktok", "TikTok"],
    ["https://store.steampowered.com/app/10", "steam", "Steam"],
    ["https://steamcommunity.com/id/maker", "steam", "Steam"],
    ["https://maker.itch.io/floor-fifty", "itchio", "itch.io"],
    ["https://itch.io/profile/maker", "itchio", "itch.io"],
    ["https://github.com/maker", "github", "GitHub"],
  ])("knows %s", (url, id, name) => {
    expect(socialSiteOf(url)).toEqual({ id, name });
  });

  it.each([
    "https://example.com/youtube.com",
    "https://notyoutube.com/x",
    "https://youtube.com.evil.example/x",
    "https://evilitch.io/x",
    "https://maker.example.com",
    "not an address",
    "",
  ])("does not know %j", (url) => {
    expect(socialSiteOf(url)).toBeNull();
  });

  it("lists the ten sites, each once", () => {
    expect(SOCIAL_SITES.map((site) => site.id)).toEqual([
      "youtube",
      "twitch",
      "discord",
      "x",
      "bluesky",
      "instagram",
      "tiktok",
      "steam",
      "itchio",
      "github",
    ]);
  });
});
