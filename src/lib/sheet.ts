// The panels that rise over a screen (Share, ••• and Report) are `<dialog class="rises">`. Opening, the browser shows
// them and look.css slides them in. Closing has to wait: the sheet gets `closing`, look.css plays the slide backwards,
// and only when that ends is the dialog closed. Every way out goes through `slideAway`, so they all look the same.

/** How long the slide away may take before the sheet is closed anyway (look.css plays it in 260ms). */
const LONGEST_SLIDE_MS = 400;

// The sheets sliding away right now, each with the step that closes it for real.
const finishers = new WeakMap<HTMLDialogElement, () => void>();

/** Slides an open sheet away, then closes it. With reduced motion it closes at once. A second call while it slides does nothing. */
export function slideAway(sheet: HTMLDialogElement): void {
  if (!sheet.open || finishers.has(sheet)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    sheet.close();
    return;
  }
  const ended = (event: AnimationEvent): void => {
    if (event.target === sheet) finish();
  };
  const finish = (): void => {
    clearTimeout(timer);
    sheet.removeEventListener("animationend", ended);
    finishers.delete(sheet);
    sheet.classList.remove("closing");
    if (sheet.open) sheet.close();
  };
  // In case the slide never reports its end (a hidden tab, say), it still closes.
  const timer = setTimeout(finish, LONGEST_SLIDE_MS);
  finishers.set(sheet, finish);
  sheet.addEventListener("animationend", ended);
  sheet.classList.add("closing");
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
