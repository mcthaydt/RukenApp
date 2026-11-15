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
  const problem = document.querySelector<HTMLElement>(".problem");
  if (problem === null) return;
  problem.scrollIntoView({ block: "nearest" });

  const heading = document.querySelector("h1");
  if (heading === null) return;
  const hidden = 8 - heading.getBoundingClientRect().top;
  if (hidden <= 0) return;
  const lowest = innerHeight - (parseFloat(getComputedStyle(problem).scrollMarginBottom) || 0);
  const room = lowest - problem.getBoundingClientRect().bottom;
  if (room > 0) scrollBy(0, -Math.min(hidden, room));
}
