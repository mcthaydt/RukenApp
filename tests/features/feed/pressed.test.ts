import { describe, expect, it } from "vitest";
import { pressOfPath, pressPath, rememberPress, takePress } from "../../../src/features/feed/pressed.ts";
import type { Cookies } from "@sveltejs/kit";

function jar(): Cookies {
  const kept = new Map<string, string>();
  return {
    get: (name: string) => kept.get(name),
    set: (name: string, value: string) => void kept.set(name, value),
    delete: (name: string) => void kept.delete(name),
  } as unknown as Cookies;
}

describe("a press that waits", () => {
  it("names its way back, and reads it again", () => {
    const path = pressPath({ game: "floor-fifty", kind: "save" });
    expect(path).toBe("/me/press?game=floor-fifty&kind=save");
    expect(pressOfPath(path)).toEqual({ game: "floor-fifty", kind: "save" });
  });

  it("reads nothing from any other address", () => {
    for (const path of [
      "/",
      "/me",
      "/me/press",
      "/me/press?game=x&kind=follow",
      "/me/press?kind=like",
      "/me/pressx?game=x&kind=like",
    ])
      expect(pressOfPath(path)).toBeNull();
  });

  it("is made once, and only when it is the press the person made", () => {
    const cookies = jar();
    expect(takePress(cookies, { game: "a", kind: "like" })).toBe(false);
    rememberPress(cookies, { game: "a", kind: "like" });
    expect(takePress(cookies, { game: "b", kind: "like" })).toBe(false);
    expect(takePress(cookies, { game: "a", kind: "like" })).toBe(false);
    rememberPress(cookies, { game: "a", kind: "like" });
    expect(takePress(cookies, { game: "a", kind: "like" })).toBe(true);
    expect(takePress(cookies, { game: "a", kind: "like" })).toBe(false);
  });
});
