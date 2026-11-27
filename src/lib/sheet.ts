// The panels that rise over a screen (Share, ••• and Report) are `<dialog class="rises">`. Opening, the browser shows
// them and look.css slides them in. Closing has to wait: the sheet gets `closing`, look.css plays the slide backwards,
// and only when that ends is the dialog closed. Every way out goes through `slideAway`, so they all look the same.

/**
 * How long a slide away may take before the sheet is closed anyway (look.css plays it in 260ms): from the press until
 * it starts, and again from its start. Counted from the start once it starts, since on a busy phone the first frame
 * can come late and a count from the press alone would cut the slide short. Generous, since Safari on a busy phone can
 * skip drawing for most of a second (seen 700 to 800ms in the journeys), and a slide cut short looks like no slide.
 */
const LONGEST_WAIT_MS = 2000;

/** The slide in's names in look.css. A sheet closed while one plays slides away from where it got to. */
const SLIDES_IN = new Set(["sheet-in", "sheet-up"]);

/**
 * The slide away's names in look.css. Events are told apart by name, never by `pseudoElement`: Safari reports the dimmed
 * screen's own animations (sheet-undim) on the dialog with an empty `pseudoElement`, and a slide in cut off by the close
 * (sheet-in, sheet-up) is not the slide away ending.
 */
const SLIDES_AWAY = new Set(["sheet-out", "sheet-down"]);

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
  const slideAwayOf = (event: AnimationEvent): boolean =>
    event.target === sheet && SLIDES_AWAY.has(event.animationName);
  // Started at the press, in case the slide never starts; started again when it does, in case it never ends.
  let timer = setTimeout(finish, LONGEST_WAIT_MS);
  const started = (event: AnimationEvent): void => {
    if (!slideAwayOf(event)) return;
    clearTimeout(timer);
    timer = setTimeout(finish, LONGEST_WAIT_MS);
  };
  // The slide away has played to its end, or was cut off.
  const stopped = (event: AnimationEvent): void => {
    if (slideAwayOf(event)) finish();
  };
  function finish(): void {
    if (finishers.get(sheet) !== finish) return;
    clearTimeout(timer);
    sheet.removeEventListener("animationstart", started);
    sheet.removeEventListener("animationend", stopped);
    sheet.removeEventListener("animationcancel", stopped);
    sheet.removeEventListener("close", finish);
    finishers.delete(sheet);
    sheet.classList.remove("closing");
    sheet.style.removeProperty("transform");
    sheet.style.removeProperty("opacity");
    sheet.inert = false;
    if (sheet.open) sheet.close();
  }
  finishers.set(sheet, finish);
  sheet.addEventListener("animationstart", started);
  sheet.addEventListener("animationend", stopped);
  sheet.addEventListener("animationcancel", stopped);
  // Closed some other way while it slides: it is tidied up all the same.
  sheet.addEventListener("close", finish);
  // Closed while still sliding in: the slide away starts from where the panel is, not from fully shown.
  const slidingIn = sheet
    .getAnimations()
    .some(
      (animation) =>
        animation instanceof CSSAnimation &&
        SLIDES_IN.has(animation.animationName) &&
        animation.playState === "running",
    );
  if (slidingIn) {
    const now = getComputedStyle(sheet);
    sheet.style.transform = now.transform;
    sheet.style.opacity = now.opacity;
  }
  sheet.classList.add("closing");
  sheet.inert = true;
  // A sheet with no slide away to play closes at once.
  const slides = sheet
    .getAnimations()
    .some((animation) => animation instanceof CSSAnimation && SLIDES_AWAY.has(animation.animationName));
  if (!slides) finish();
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
