import { describe, expect, it } from "vitest";
import { GAME_FRAME_ALLOW, GAME_FRAME_SANDBOX } from "../../../src/features/play/frame.ts";

describe("a game's frame", () => {
  it("is sandboxed to run its own scripts, keep its own storage and lock the pointer, and nothing else", () => {
    expect(GAME_FRAME_SANDBOX).toBe("allow-scripts allow-same-origin allow-pointer-lock");
  });

  it("may not take the page, open windows, send forms, pop up, download or turn the screen", () => {
    for (const power of [
      "allow-top-navigation",
      "allow-popups",
      "allow-forms",
      "allow-modals",
      "allow-downloads",
      "allow-orientation-lock",
    ]) {
      expect(GAME_FRAME_SANDBOX).not.toContain(power);
    }
  });

  // The last two are new: FloorFifty copies and shares a link.
  it("lets a game ask for a gamepad, full screen, sound, the clipboard and sharing", () => {
    expect(GAME_FRAME_ALLOW).toBe("gamepad; fullscreen; autoplay; clipboard-write; web-share");
  });
});
