// What a gamepad's buttons and stick mean on Ruken's screens, read the way a console does. Pure, so the page layer
// (src/lib/pad-focus.ts) stays a thin loop over it and a test can hold a button down for any length of time.

/** One thing a person asked for with the gamepad. */
export type PadPress = "up" | "down" | "left" | "right" | "press" | "back" | "tabBack" | "tabNext" | "menu";

/** What the browser tells about one pad (the parts of the Gamepad API that are read). */
export interface PadReading {
  readonly buttons: readonly { readonly pressed: boolean }[];
  readonly axes: readonly number[];
}

/** When each press started and when it last counted, carried from one look at the pads to the next. */
export type PadMemory = Partial<Record<PadPress, { since: number; last: number }>>;

// The standard layout (w3c.github.io/gamepad/#remapping): A, B, the two shoulder buttons, View (Back or Select),
// the D-pad, and the Home button in the middle.
const A = 0;
const B = 1;
const LEFT_SHOULDER = 4;
const RIGHT_SHOULDER = 5;
const VIEW = 8;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const HOME = 16;

/** A stick pushed less than half way is resting, so a worn stick that leans a little moves nothing. */
export const STICK_DEAD = 0.5;
/** A direction held down moves once, then again after this long, as a held key does. */
export const REPEAT_AFTER_MS = 450;
/** And then once every this long while it is still held. */
export const REPEAT_EVERY_MS = 150;
/** Holding View this long asks for Ruken's menu over a game, for pads whose Home button the system keeps for itself. */
export const MENU_HOLD_MS = 1000;

const DIRECTIONS = new Set<PadPress>(["up", "down", "left", "right"]);

function pressed(pad: PadReading, index: number): boolean {
  return pad.buttons[index]?.pressed === true;
}

/** What is held right now on any of the pads, as presses (several pads count as one). View is kept apart: it only
 * counts once held long enough. */
export function heldNow(pads: readonly PadReading[]): { held: Set<PadPress>; view: boolean } {
  const held = new Set<PadPress>();
  let view = false;
  for (const pad of pads) {
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (pressed(pad, DPAD_UP) || y <= -STICK_DEAD) held.add("up");
    if (pressed(pad, DPAD_DOWN) || y >= STICK_DEAD) held.add("down");
    if (pressed(pad, DPAD_LEFT) || x <= -STICK_DEAD) held.add("left");
    if (pressed(pad, DPAD_RIGHT) || x >= STICK_DEAD) held.add("right");
    if (pressed(pad, A)) held.add("press");
    if (pressed(pad, B)) held.add("back");
    if (pressed(pad, LEFT_SHOULDER)) held.add("tabBack");
    if (pressed(pad, RIGHT_SHOULDER)) held.add("tabNext");
    if (pressed(pad, HOME)) held.add("menu");
    if (pressed(pad, VIEW)) view = true;
  }
  return { held, view };
}

/**
 * The presses that count at `now`, given what is held and what was held before. A button counts once when it goes
 * down; a direction also counts again while it is held, like a key. View held for a second counts as the menu, once.
 * Returns the presses and the memory for the next look.
 */
export function pressesAt(
  pads: readonly PadReading[],
  memory: PadMemory,
  viewSince: number | null,
  now: number,
): { presses: PadPress[]; memory: PadMemory; viewSince: number | null } {
  const { held, view } = heldNow(pads);
  const presses: PadPress[] = [];
  const next: PadMemory = {};
  for (const press of held) {
    const before = memory[press];
    if (before === undefined) {
      presses.push(press);
      next[press] = { since: now, last: now };
      continue;
    }
    const wait = before.last === before.since ? REPEAT_AFTER_MS : REPEAT_EVERY_MS;
    const repeats = DIRECTIONS.has(press) && now - before.last >= wait;
    if (repeats) presses.push(press);
    next[press] = { since: before.since, last: repeats ? now : before.last };
  }

  // View: null while up, the time it went down while held, and -1 once it has counted, so holding on does not repeat.
  let viewAt: number | null = null;
  if (view) {
    viewAt = viewSince ?? now;
    if (viewAt >= 0 && now - viewAt >= MENU_HOLD_MS) {
      if (!held.has("menu")) presses.push("menu");
      viewAt = -1;
    }
  }
  return { presses, memory: next, viewSince: viewAt };
}
