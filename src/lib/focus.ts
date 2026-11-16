// Where a refused form sends the keyboard: to the first box that was refused, so a phone scrolls to it and a screen
// reader reads its hint and its refusal (a refused box is marked `aria-invalid`).

/** Puts the focus on the first refused box on the page, if there is one. */
export function focusFirstRefused(): void {
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/**
 * Brings the refusal's words into view, and the question they are about when both fit. A phone's buttons are a bar pinned
 * over the foot of the window, and the words that say what is wrong sit under the box, so focusing the box can leave them
 * under the bar: the maker would see a ring and no reason. The stylesheet gives a refusal a margin as tall as the bar, so
 * "nearest" stops it above the bar and moves nothing where the words are already in view. On a short window that scroll
 * could push the question's heading off the top, so the reason was read without the question; the page then comes back
 * down as far as the reason can go and still be above the bar, to bring the heading back.
 */
export function showTheRefusal(): void {
  // The first one that is on the page: a page that asks one question at a time keeps the others' lines hidden.
  const problem = [...document.querySelectorAll<HTMLElement>(".problem")].find(
    (one) => one.getClientRects().length > 0,
  );
  if (problem === undefined) return;
  // A line rises 28px into place over 460ms, and a box measured on the way is 28px lower than where it ends up, so the page was
  // scrolled 28px too far and the heading's place was misjudged. Every line is where it ends up at once, and then measured.
  // (The drifting circles go on for ever and are left alone.)
  for (const animation of document.getAnimations()) {
    if (animation.effect?.getComputedTiming().iterations !== Infinity) animation.finish();
  }
  problem.scrollIntoView({ block: "nearest" });

  const heading = document.querySelector("h1");
  if (heading === null) return;
  const hidden = 8 - heading.getBoundingClientRect().top;
  if (hidden <= 0) return;
  // The lowest the reason may sit is just above the bar where the bar is pinned to the window; the stylesheet's margin is more
  // than that (it is generous so the reason is not tight against the bar), and on a window 320 tall would leave no room at all.
  const bar = document.querySelector<HTMLElement>(".acts");
  const barTop =
    bar !== null && getComputedStyle(bar).position === "fixed"
      ? bar.getBoundingClientRect().top
      : innerHeight;
  const room = barTop - 8 - problem.getBoundingClientRect().bottom;
  if (room > 0) scrollBy(0, -Math.min(hidden, room));
}
