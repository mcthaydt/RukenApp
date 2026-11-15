import { describe, expect, it } from "vitest";
import { partsToCheck, type GameToCheck } from "../../../src/features/admin/admin.ts";
import { LIVE_MAY_BE_SENT_BACK } from "../../../src/features/games/games.ts";

// The eight parts staff tick on the check page, in the order a game's parts are always listed.

const media = (key: string) => `https://media.test/${key}`;

const FIRST_SEND: GameToCheck = {
  name: "Tiny game",
  state: "waiting",
  oneLine: "A tiny game about tapping.",
  playsOn: "phone_and_computer",
  ageRating: "age_12",
  contentMarks: [],
  pending: { fileCount: 3, totalBytes: 1_000_000, connectHosts: ["api.example.com"] },
  clipKeys: { upright: "clips/a/upright-1.mp4", wide: "clips/a/wide-1.mp4" },
};

describe("partsToCheck", () => {
  it("lists the eight parts in a game's order, with their titles", () => {
    expect(partsToCheck(FIRST_SEND, media).map((one) => [one.part, one.title])).toEqual([
      ["name", "Name"],
      ["one_line", "One line"],
      ["files", "Game files"],
      ["plays_on", "Where it plays"],
      ["upright_video", "Upright video"],
      ["wide_video", "Wide video"],
      ["age_rating", "Who it's for"],
      ["other_websites", "Other websites"],
    ]);
  });

  it("says each part in the maker's own words, measured and never typed", () => {
    const words = Object.fromEntries(partsToCheck(FIRST_SEND, media).map((one) => [one.part, one.value]));
    expect(words).toMatchObject({
      name: "Tiny game",
      one_line: "A tiny game about tapping.",
      files: "3 files, 1 MB",
      plays_on: "Plays on phones and computers",
      upright_video: null,
      wide_video: null,
      age_rating: "12+",
      other_websites: "Uses api.example.com",
    });
  });

  it("gives each video its address and its shape", () => {
    const parts = partsToCheck(FIRST_SEND, media);
    expect(parts.find((one) => one.part === "upright_video")?.video).toEqual({
      src: "https://media.test/clips/a/upright-1.mp4",
      shape: "upright",
    });
    expect(parts.find((one) => one.part === "wide_video")?.video).toEqual({
      src: "https://media.test/clips/a/wide-1.mp4",
      shape: "wide",
    });
  });

  it("gives every part a tick and a list of reasons that ends with Something else (a first send)", () => {
    for (const one of partsToCheck(FIRST_SEND, media)) {
      expect(one.canTick, one.part).toBe(true);
      expect(one.reasons.length, one.part).toBeGreaterThan(1);
      expect(one.reasons.at(-1), one.part).toEqual({ code: "something_else", words: "Something else" });
    }
  });

  it("gives a live game's update a tick only on what its maker can still fix (Review Focus 6)", () => {
    const update: GameToCheck = { ...FIRST_SEND, state: "live" };
    const ticked = partsToCheck(update, media)
      .filter((one) => one.canTick)
      .map((one) => one.part);
    expect(ticked).toEqual(["name", "one_line", "files", "plays_on"]);
    expect([...LIVE_MAY_BE_SENT_BACK].sort()).toEqual([...ticked].sort());
  });

  it("shows no reasons for a part with no tick", () => {
    const update: GameToCheck = { ...FIRST_SEND, state: "live" };
    expect(partsToCheck(update, media).find((one) => one.part === "age_rating")?.reasons).toEqual([]);
  });

  it("adds an 18+ game's marks to its rating", () => {
    const adult: GameToCheck = { ...FIRST_SEND, ageRating: "age_18", contentMarks: ["gore"] };
    expect(partsToCheck(adult, media).find((one) => one.part === "age_rating")?.value).toBe("18+ · Gore");
  });

  it("says a game that uses no other websites uses none", () => {
    const quiet: GameToCheck = { ...FIRST_SEND, pending: { fileCount: 1, totalBytes: 10, connectHosts: [] } };
    expect(partsToCheck(quiet, media).find((one) => one.part === "other_websites")?.value).toBe(
      "Uses no other websites",
    );
  });

  it("says 1 file, not 1 files", () => {
    const one: GameToCheck = { ...FIRST_SEND, pending: { fileCount: 1, totalBytes: 10, connectHosts: [] } };
    expect(partsToCheck(one, media).find((part) => part.part === "files")?.value).toBe("1 file, 1 MB");
  });
});
