// Whether a person is playing, as the page can tell (spec 4.2): the tab is showing, the game's box is on screen and the
// game has the focus. The page looks once a second; a stretch counts as attentive only when every look was. Pure,
// with no browser in it, so the rule is tested without one.

/** What one look at the page saw. */
export interface Look {
  tabShowing: boolean;
  frameOnScreen: boolean;
  frameFocused: boolean;
}

export function createAttention(): { look(now: Look): void; report(): boolean; taken(): void } {
  let looks = 0;
  let broken = false;
  return {
    look(now) {
      looks += 1;
      if (!now.tabShowing || !now.frameOnScreen || !now.frameFocused) broken = true;
    },
    /** Whether every look since the last taken beat was attentive; false when there was no look at all. */
    report: () => looks > 0 && !broken,
    /** The server took the beat, so a new stretch starts. A beat that was lost is still spoken for by the next. */
    taken() {
      looks = 0;
      broken = false;
    },
  };
}
