// Where a refused form sends the keyboard: to the first box that was refused, so a phone scrolls to it and a screen
// reader reads its hint and its refusal (a refused box is marked `aria-invalid`).

/** Puts the focus on the first refused box on the page, if there is one. */
export function focusFirstRefused(): void {
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
