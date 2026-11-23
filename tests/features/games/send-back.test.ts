import { describe, expect, it } from "vitest";
import {
  isReasonFor,
  makerWords,
  partNoun,
  partTitle,
  reasonsFor,
} from "../../../src/features/games/send-back.ts";
import type { GamePart } from "../../../src/lib/server/db.ts";

// Staff send a game back part by part, each with a reason from a short list (spec 11.2). The words the maker reads
// are written once, in the library file, and pinned here.

const ALL_PARTS: GamePart[] = [
  "name",
  "one_line",
  "files",
  "plays_on",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

/** Part, code, what staff choose, and what the maker reads ({name} is the game's name). */
const REASONS: [GamePart, string, string, string][] = [
  ["name", "rude", "It's rude.", "We can't show this name on Ruken. It's rude. Pick another."],
  ["name", "not_this_game", "It's not this game's.", "This name belongs to a different game. Pick your own."],
  ["one_line", "rude", "It's rude.", "We can't show this line on Ruken. It's rude. Write another."],
  [
    "one_line",
    "not_this_game",
    "It's not this game's.",
    "This line isn't about your game. Say what {name} is.",
  ],
  [
    "files",
    "wont_start",
    "It doesn't start.",
    "Your game didn't start for us. Fix it on GitHub, then send it again.",
  ],
  [
    "files",
    "breaks",
    "It stops working.",
    "Your game stopped working while we played. Fix it on GitHub, then send it again.",
  ],
  [
    "files",
    "past_limit",
    "It goes past what we allow.",
    "Your game has too much in it for Ruken. Take some files out on GitHub, then send it again.",
  ],
  ["files", "pornography", "It's pornography.", "Ruken doesn't take pornography."],
  ["files", "gambling", "Gambling isn't allowed on Ruken.", "Gambling isn't allowed on Ruken."],
  [
    "files",
    "ads",
    "It has ads.",
    "Games on Ruken can't have ads. Take them out on GitHub, then send it again.",
  ],
  [
    "plays_on",
    "needs_keyboard",
    "It needs a keyboard.",
    "Your game needs a keyboard, so it can't play on phones. Every game must work on both.",
  ],
  ["upright_video", "sideways", "It's sideways.", "It's sideways. Turn it the right way up."],
  [
    "upright_video",
    "not_this_game",
    "It's not from this game.",
    "It shows a different game. Add a video of {name}.",
  ],
  ["upright_video", "too_dark", "It's too dark to see.", "It's too dark to see. Record it again, brighter."],
  ["wide_video", "sideways", "It's sideways.", "It's sideways. Turn it the right way up."],
  [
    "wide_video",
    "not_this_game",
    "It's not from this game.",
    "It shows a different game. Add a video of {name}.",
  ],
  ["wide_video", "too_dark", "It's too dark to see.", "It's too dark to see. Record it again, brighter."],
  ["age_rating", "wrong_age", "The age is wrong.", "We think {name} is for older players. Choose again."],
  [
    "other_websites",
    "not_listed",
    "It uses a website it didn't list.",
    "Your game uses a website that isn't on your list. Add it.",
  ],
];

describe("the reasons a part can be sent back for", () => {
  it("every part's list ends with Something else", () => {
    for (const part of ALL_PARTS) {
      const list = reasonsFor(part);
      expect(list.length, part).toBeGreaterThan(1);
      expect(list.at(-1)?.code, part).toBe("something_else");
    }
  });

  it.each(REASONS)("%s: %s is offered with staff's and the maker's words", (part, code, staff, maker) => {
    const reason = reasonsFor(part).find((one) => one.code === code);
    expect(reason?.staff).toBe(staff);
    expect(reason?.maker).toBe(maker);
    expect(isReasonFor(part, code)).toBe(true);
  });

  it("lists nothing beyond the table and Something else", () => {
    for (const part of ALL_PARTS) {
      const expected = REASONS.filter((row) => row[0] === part).map((row) => row[1]);
      expect(reasonsFor(part).map((one) => one.code)).toEqual([...expected, "something_else"]);
    }
  });

  it("refuses a reason that belongs to another part", () => {
    expect(isReasonFor("name", "sideways")).toBe(false);
    expect(isReasonFor("name", "nonsense")).toBe(false);
    expect(isReasonFor("name", "something_else")).toBe(true);
  });
});

describe("what the maker reads", () => {
  it("puts the game's name into the reason's words", () => {
    expect(makerWords("upright_video", "not_this_game", null, "Floor Fifty")).toBe(
      "It shows a different game. Add a video of Floor Fifty.",
    );
  });

  it("for Something else, is the staff member's own line", () => {
    expect(makerWords("name", "something_else", "Too close to another game's name.", "x")).toBe(
      "Too close to another game's name.",
    );
  });

  it("keeps every reason short, with a long name filled in", () => {
    for (const [part, code] of REASONS) {
      expect(makerWords(part, code, null, "Floor Fifty").length, `${part} ${code}`).toBeLessThanOrEqual(90);
    }
  });
});

describe("the names of the parts", () => {
  it("titles a part on the card that asks for a fix", () => {
    expect(partTitle("name", "Floor Fifty")).toBe("Name: Floor Fifty");
    expect(ALL_PARTS.filter((part) => part !== "name").map((part) => partTitle(part, "x"))).toEqual([
      "One line",
      "Game files",
      "Where it plays",
      "Upright video",
      "Wide video",
      "Who it's for",
      "Other websites",
    ]);
  });

  it("names a part for the button that leads to it", () => {
    expect(ALL_PARTS.map(partNoun)).toEqual([
      "the name",
      "the line",
      "your game's files",
      "where it plays",
      "the upright video",
      "the wide video",
      "who it's for",
      "the websites",
    ]);
  });
});
