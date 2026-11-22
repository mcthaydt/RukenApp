// A form sent the plain way (a full page load, no script of its own) gives no sign that anything is happening while
// the site answers, and a second press sends it twice. One listener in the layout covers every such form, so a new
// form needs nothing to get it. A form with its own script (`use:enhance`) stops the plain send itself, and shows its
// own busy button with its own words.

/** How long a press stays taken. A person who stopped the page loading can then press again. */
const TAKEN_FOR_MS = 15_000;

/** Marks the pressed form and its button busy, or stops a second press while the first is out. */
export function markSending(event: SubmitEvent): void {
  if (event.defaultPrevented) return;
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.getAttribute("aria-busy") === "true") {
    event.preventDefault();
    return;
  }
  form.setAttribute("aria-busy", "true");
  // Not `disabled`: a disabled button leaves its own name and value out of what the form sends.
  const button = event.submitter ?? form.querySelector("button:not([type='button'])");
  if (button instanceof HTMLElement) {
    button.setAttribute("aria-busy", "true");
    button.setAttribute("aria-disabled", "true");
  }
  setTimeout(() => {
    clearSending(form);
  }, TAKEN_FOR_MS);
}

/** Takes the busy marks off a form, or off every form: a page the browser brings back from Back keeps them otherwise. */
export function clearSending(within: Element | Document = document): void {
  const marked = [within, ...within.querySelectorAll("[aria-busy='true']")];
  for (const element of marked) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.getAttribute("aria-busy") !== "true") continue;
    element.removeAttribute("aria-busy");
    element.removeAttribute("aria-disabled");
  }
}
