// Whether the feed's sound is on, kept for the life of the open tab rather than the feed's own screen: the feed is made
// again each time a person comes back to it (from a game's page, by its arrow or the browser's Back, or from another
// tab), and the speaker stays as they last set it (the owner, 2026-11-28: "it should stay unmuted until I press mute
// again").
//
// It is kept in memory, not in the browser's storage, so a reload or a new visit starts quiet. A browser lets a page
// play sound only after a press on that page: after a reload nothing has been pressed yet, so the clip would be refused
// and play quiet anyway, and the speaker would claim sound it cannot give. Moving inside Ruken keeps the earlier press,
// so sound carries from screen to screen.
//
// Only a press in the browser changes it; the server never does, so the copy the server holds stays "off".

let soundOn = false;

/** Whether the person last left the feed's sound on, in this open tab. */
export function soundWanted(): boolean {
  return soundOn;
}

/** Keeps the speaker as the person set it, for the next time the feed comes up. */
export function keepSound(on: boolean): void {
  soundOn = on;
}
