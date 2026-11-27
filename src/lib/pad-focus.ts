// The gamepad on every screen (the owner, 2026-11-27: "everything should be fully navigable using a gamepad"). It drives
// the same focus the keyboard does, so every control a key can reach a pad can too, with the same ring:
// - the D-pad or the left stick moves the focus to the nearest control that way (src/lib/pad-moves.ts);
// - A presses the focused control; B closes what is open, or goes back;
// - the shoulder buttons pick the tab before or after on a screen's row of tabs (`data-pad-tabs`);
// - Home, or View held for a second, asks for Ruken's menu over a game (the play screen listens for `PAD_MENU`).
// A screen's own keys come first: each direction is offered to the screen as its arrow key, and moves the focus only
// when nothing took it. So the feed keeps up and down for its clips. While a game's frame has the focus the game reads
// the pad itself, and only the menu press counts here.

import { pressesAt, type PadMemory, type PadPress, type PadReading } from "./gamepad.ts";
import { nextBox, type Way } from "./pad-moves.ts";

/** Sent on the window when the gamepad asks for Ruken's menu over a game. */
export const PAD_MENU = "rk-pad-menu";

const CONTROLS =
  "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), summary, [tabindex]";

/** A screen's main control, where a first press lands: one marked itself, or the main button inside a marked part. */
const FIRST = "[data-pad-first], [data-pad-first] .button";

const ARROWS: Record<Way, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

/** How the page goes back when the screen has no Back of its own: only to a page inside Ruken. */
export interface PadOptions {
  canGoBack: () => boolean;
}

/** A control the focus can land on: one Tab reaches, that is drawn, and is not shut away behind a sheet or hidden. */
function isControl(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.closest("[inert], [aria-hidden='true']") !== null) return false;
  // A summary is only a control when it is its details' own first summary.
  if (element.tagName === "SUMMARY" && element.parentElement?.tagName !== "DETAILS") return false;
  return element.checkVisibility({ visibilityProperty: true });
}

function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
}

/** Where the focus may go: inside an open sheet, inside a menu that holds the focus, or anywhere on the screen. */
function scope(): Element | Document {
  const sheets = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter((sheet) =>
    sheet.matches(":modal"),
  );
  return sheets.at(-1) ?? document.querySelector("[data-pad-scope]") ?? document;
}

function controlsIn(where: Element | Document): HTMLElement[] {
  return [...where.querySelectorAll<HTMLElement>(CONTROLS)].filter(isControl);
}

/** The focused control, when it is one in reach and on screen; a focus left on a clip that has slid away does not count. */
function focusedControl(where: Element | Document): HTMLElement | null {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || focused === document.body) return null;
  if (where !== document && !where.contains(focused)) return null;
  return isControl(focused) && onScreen(focused) ? focused : null;
}

function focusOn(element: HTMLElement, scroll = true): void {
  element.focus({ preventScroll: !scroll, focusVisible: true });
  if (scroll) element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** The control a first press lands on: the screen's main one (`data-pad-first`), else the first in its main part. */
function startingControl(where: Element | Document): HTMLElement | null {
  const shown = controlsIn(where).filter(onScreen);
  return (
    shown.find((control) => control.matches(FIRST)) ??
    shown.find((control) => control.closest("main") !== null) ??
    shown[0] ??
    null
  );
}

/** Offers a key to the screen, as if it were pressed on the focused control. True when the screen took it. */
function offerKey(key: string): boolean {
  const target = document.activeElement ?? document.body;
  const down = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(down);
  target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  return down.defaultPrevented;
}

export function startPad(options: PadOptions): () => void {
  let memory: PadMemory = {};
  let viewSince: number | null = null;
  let frame = 0;
  // After the feed has slid to another clip, the focus goes to that clip's main control once the slide has settled.
  let settle: { scroller: Element; top: number; still: number; until: number } | null = null;

  function pads(): PadReading[] {
    return [...navigator.getGamepads()].filter((pad): pad is Gamepad => pad !== null && pad.connected);
  }

  function move(way: Way): void {
    const where = scope();
    const line = where === document ? document.querySelector("[data-pad='line']") : null;
    if (offerKey(ARROWS[way])) {
      if (line !== null && (way === "up" || way === "down"))
        settle = { scroller: line, top: line.scrollTop, still: 0, until: performance.now() + 3000 };
      return;
    }
    const from = focusedControl(where);
    if (from === null) {
      const start = startingControl(where);
      if (start !== null) focusOn(start);
      return;
    }
    const others = controlsIn(where).filter((control) => control !== from);
    // A screen that is one row of things (the feed) goes left and right along it: its own controls first, then the rest.
    if (line !== null && (way === "left" || way === "right")) {
      const row = controlsIn(where)
        .filter(onScreen)
        .sort((a, b) => Number(line.contains(b)) - Number(line.contains(a)));
      const here = row.indexOf(from);
      const next = row[here + (way === "right" ? 1 : -1)];
      if (next !== undefined) focusOn(next);
      return;
    }
    const shown = others.filter(onScreen);
    const box = from.getBoundingClientRect();
    let index = nextBox(
      box,
      shown.map((control) => control.getBoundingClientRect()),
      way,
    );
    if (index !== -1) {
      const target = shown[index];
      if (target !== undefined) focusOn(target);
      return;
    }
    // Nothing that way on screen: the screen's own scrolled box may hold more below or above.
    index = nextBox(
      box,
      others.map((control) => control.getBoundingClientRect()),
      way,
    );
    const target = others[index];
    if (target !== undefined) focusOn(target);
  }

  function press(): void {
    const where = scope();
    const focused = focusedControl(where);
    if (focused === null) {
      const start = startingControl(where);
      if (start !== null) focusOn(start);
      return;
    }
    if (focused instanceof HTMLSelectElement) {
      try {
        focused.showPicker();
      } catch {
        // A browser that will not open the list leaves it focused; the arrow keys of a keyboard still change it.
      }
      return;
    }
    // A box for words is already where the typing goes; the system's own keyboard comes up for it.
    if (focused instanceof HTMLTextAreaElement) return;
    if (
      focused instanceof HTMLInputElement &&
      !["checkbox", "radio", "submit", "button", "file", "reset"].includes(focused.type)
    )
      return;
    focused.click();
  }

  function back(): void {
    const where = scope();
    if (where instanceof HTMLDialogElement) {
      // As Escape does: the sheet hears it is asked to close, and may slide away first.
      const ask = new Event("cancel", { cancelable: true });
      if (where.dispatchEvent(ask)) where.close();
      return;
    }
    if (where !== document) {
      offerKey("Escape");
      return;
    }
    const own = controlsIn(document).find(
      (control) => control.getAttribute("aria-label") === "Back" && onScreen(control),
    );
    if (own !== undefined) own.click();
    else if (options.canGoBack()) history.back();
  }

  function tab(by: -1 | 1): void {
    const row = [...scope().querySelectorAll<HTMLElement>("[data-pad-tabs]")].find(onScreen);
    if (row === undefined) return;
    const tabs = controlsIn(row);
    const here = tabs.findIndex(
      (one) => one.getAttribute("aria-selected") === "true" || one.hasAttribute("aria-current"),
    );
    const next = tabs[here + by];
    if (here === -1 || next === undefined) return;
    focusOn(next);
    next.click();
  }

  function act(what: PadPress, inGame: boolean): void {
    if (what === "menu") {
      dispatchEvent(new CustomEvent(PAD_MENU));
      return;
    }
    if (inGame) return;
    if (what === "press") press();
    else if (what === "back") back();
    else if (what === "tabBack") tab(-1);
    else if (what === "tabNext") tab(1);
    else move(what);
  }

  function settleFocus(now: number): void {
    if (settle === null) return;
    if (now > settle.until) {
      settle = null;
      return;
    }
    const top = settle.scroller.scrollTop;
    settle.still = top === settle.top ? settle.still + 1 : 0;
    settle.top = top;
    if (settle.still < 3) return;
    settle = null;
    const main = [...document.querySelectorAll<HTMLElement>(FIRST)].find((control) => {
      const box = control.getBoundingClientRect();
      return isControl(control) && box.top >= 0 && box.bottom <= innerHeight;
    });
    if (main !== undefined) focusOn(main, false);
  }

  function look(now: number): void {
    const connected = pads();
    if (connected.length === 0) {
      frame = 0;
      memory = {};
      viewSince = null;
      return;
    }
    const read = pressesAt(connected, memory, viewSince, now);
    memory = read.memory;
    viewSince = read.viewSince;
    const inGame = document.activeElement?.tagName === "IFRAME";
    for (const what of read.presses) act(what, inGame);
    settleFocus(now);
    frame = requestAnimationFrame(look);
  }

  function wake(): void {
    if (frame === 0) frame = requestAnimationFrame(look);
  }

  addEventListener("gamepadconnected", wake);
  // A pad already connected before this page opened shows up at once in some browsers, with no event.
  if (pads().length > 0) wake();
  return () => {
    cancelAnimationFrame(frame);
    frame = 0;
    removeEventListener("gamepadconnected", wake);
  };
}
