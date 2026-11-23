// The feed's ranking is private (docs/superpowers/specs/2026-11-22-private-feed-ranking-design.md, C5): this public
// repository may name only the three feed settings the app itself acts on (`learned`, `teenPersonal`, `windowDays`).
// It fails if any file the app is built from names another feed setting or switch, the private ranker's `signals/`
// folder, or the private Worker's settings secret. The names below are already public, in the learned feed spec merged in
// #342; they are listed here, in a test, only so that nothing outside the tests uses them.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

const PRIVATE_KEYS = [
  "halfLifeDays",
  "dailyCapMinutes",
  "comebackWeight",
  "freeShareMax",
  "firstShowingMembers",
  "firstShowingViewers",
  "firstShowingDays",
  "firstShowingEvery",
  "learnFromPlayers",
  "quickNoMs",
  "lessDays",
  "surpriseRate",
  "sameCrowd",
  "echoAfter",
  "goodPickMinutes",
  "goodPickDays",
  "roundShake",
  "testClipViews",
  "testClipPriorTaps",
  "testClipPriorViews",
  "fewPlayTapShare",
  "moodLearnPlayers",
  "genreWeight",
  "skyLiftMax",
  "skyMoodShare",
  "surpriseRange",
  "skyElementStep",
  "newMoonFirstShowingEvery",
  "fullMoonStandingWeight",
  "retrogradeIdleDays",
  "highTasteLike",
  "highTasteLikeReview",
  "highTasteAll",
  "highTasteCapPerGame",
  "highTasteEarnedMax",
  "freeWatchers",
  "firstShowing",
  "quietSignals",
  "goodPick",
  "testClips",
  "learnedMood",
  "highTaste",
  "parentYes",
];
/** Switches that are also plain words: they count only where code names them (`.sky`, `sky:`, `"sky"`). */
const PRIVATE_WORDS = ["comeback", "surprises", "echo", "spacing", "sky"];

/** Every file under a folder, as absolute paths. */
function filesUnder(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

const files = [
  ...filesUnder(join(ROOT, "src")),
  ...filesUnder(join(ROOT, "cloudflare")),
  join(ROOT, "wrangler.jsonc"),
];

/** What in a text breaks the boundary, as plain words. */
function breaches(text: string): string[] {
  const found: string[] = [];
  for (const key of PRIVATE_KEYS) {
    if (new RegExp(`(?<![\\w-])${key}(?![\\w-])`).test(text)) found.push(key);
  }
  for (const word of PRIVATE_WORDS) {
    if (new RegExp(`\\.${word}\\b|(?<![\\w-])${word}\\s*\\??:|["'\`]${word}["'\`]`).test(text))
      found.push(word);
  }
  if (/signals\//.test(text)) found.push("signals/");
  if (/FEED_SETTINGS/.test(text)) found.push("FEED_SETTINGS");
  return found;
}

describe("the feed's private boundary", () => {
  it("no file the app is built from names a private feed setting, signals/ or FEED_SETTINGS", () => {
    const found = files.flatMap((file) =>
      breaches(readFileSync(file, "utf8")).map((what) => `${relative(ROOT, file)}: ${what}`),
    );
    expect(found).toEqual([]);
  });

  it("catches each kind of breach (so an empty answer above means something)", () => {
    expect(breaches("const settings = { halfLifeDays: 3 };")).toEqual(["halfLifeDays"]);
    expect(breaches("if (settings.sky) lift();")).toEqual(["sky"]);
    expect(breaches('read("echo")')).toEqual(["echo"]);
    expect(breaches('import { taste } from "./signals/taste.ts";')).toEqual(["signals/"]);
    expect(breaches("env.FEED_SETTINGS")).toEqual(["FEED_SETTINGS"]);
    expect(breaches("letter-spacing: 0.1em; the night sky; learned teenPersonal windowDays")).toEqual([]);
  });
});
