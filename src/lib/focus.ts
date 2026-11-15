// Where a refused form sends the keyboard: to the first box that was refused, so a phone scrolls to it and a screen
// reader reads its hint and its refusal (a refused box is marked `aria-invalid`).

/** Puts the focus on the first refused box on the page, if there is one. */
export function focusFirstRefused(): void {
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/**
 * Brings the refusal's words into view. A phone's buttons are a bar pinned over the foot of the window, and the words that
 * say what is wrong sit under the box, so focusing the box can leave them under the bar: the maker would see a ring and no
 * reason. The stylesheet gives a refusal a margin as tall as the bar, so "nearest" stops it above the bar and moves nothing
 * where the words are already in view.
 */
export function showTheRefusal(): void {
  document.querySelector<HTMLElement>(".problem")?.scrollIntoView({ block: "nearest" });
}
