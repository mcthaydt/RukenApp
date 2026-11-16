// Whether a stretch of play was attentive, as a page sees it. Pure: the page looks once a second and hands over what
// it saw, so nothing here touches a browser and the rule can be tested alone. The server decides how much time a beat
// is worth; this only says whether the person was there for all of it.

/** What one look saw: the tab showing, the game's frame on screen, and the frame being what the person last touched. */
export interface Look {
  tabShowing: boolean;
  frameOnScreen: boolean;
  frameFocused: boolean;
}

export interface Attention {
  /** Records one look. Any look with one of the three false breaks the stretch. */
  look(now: Look): void;
  /** Whether every look since the server last took a beat was attentive; false when there was no look at all. */
  report(): boolean;
  /** The server took a beat: a new stretch starts. A beat that was lost never calls this, so the next one still speaks for it. */
  taken(): void;
}

export function createAttention(): Attention {
  let looked = false;
  let broken = false;
  return {
    look(now) {
      looked = true;
      if (!now.tabShowing || !now.frameOnScreen || !now.frameFocused) broken = true;
    },
    report() {
      return looked && !broken;
    },
    taken() {
      looked = false;
      broken = false;
    },
  };
}
