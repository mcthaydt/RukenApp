// The panels that rise over a screen (Share, ••• and Report) are `<dialog class="rises">`. Opening, the browser shows
// them and look.css slides them in. Closing has to wait: the sheet gets `closing`, look.css plays the slide backwards,
// and only when that ends is the dialog closed. Every way out goes through `slideAway`, so they all look the same.

/**
 * How long a slide away may run, counted from when it starts, before the sheet is closed anyway (look.css plays it in
 * 260ms). It is counted from the slide's start, never from the press: on a busy phone the first frame can come late,
 * and a count from the press would cut the slide short.
 */
const LONGEST_SLIDE_MS = 1000;

// The sheets sliding away right now, each with the step that closes it for real.
const finishers = new WeakMap<HTMLDialogElement, () => void>();

/**
 * Slides an open sheet away, then closes it when the slide ends. With reduced motion, or in a tab nobody sees, it
 * closes at once. A second call while it slides does nothing. While it slides it takes no presses or keys.
 */
export function slideAway(sheet: HTMLDialogElement): void {
  if (!sheet.open || finishers.has(sheet)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) {
    sheet.close();
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const own = (event: AnimationEvent): boolean => event.target === sheet && event.pseudoElement === "";
  const started = (event: AnimationEvent): void => {
    if (!own(event) || timer !== undefined) return;
    // In case the slide never reports its end, it still closes.
    timer = setTimeout(finish, LONGEST_SLIDE_MS);
  };
  // The panel's own slide (not the dimmed screen's) has played to its end, or was cut off.
  const stopped = (event: AnimationEvent): void => {
    if (own(event)) finish();
  };
  const finish = (): void => {
    if (finishers.get(sheet) !== finish) return;
    clearTimeout(timer);
    sheet.removeEventListener("animationstart", started);
    sheet.removeEventListener("animationend", stopped);
    sheet.removeEventListener("animationcancel", stopped);
    finishers.delete(sheet);
    sheet.classList.remove("closing");
    sheet.inert = false;
    if (sheet.open) sheet.close();
  };
  finishers.set(sheet, finish);
  sheet.addEventListener("animationstart", started);
  sheet.addEventListener("animationend", stopped);
  sheet.addEventListener("animationcancel", stopped);
  sheet.classList.add("closing");
  sheet.inert = true;
  // A sheet with no slide to play (its look turned off) closes at once.
  if (sheet.getAnimations().length === 0) finish();
}

/** Closes a sheet that is still sliding away at once, so it can open again straight after. */
export function stopSliding(sheet: HTMLDialogElement): void {
  finishers.get(sheet)?.();
}

/**
 * For a sheet's `cancel` event (Escape, or a gamepad's B): slides it away instead of letting it vanish. Where the
 * browser does not let the page hold the close back, it closes at once as before.
 */
export function slideAwayOnCancel(event: Event): void {
  if (!event.cancelable || !(event.currentTarget instanceof HTMLDialogElement)) return;
  event.preventDefault();
  slideAway(event.currentTarget);
}
