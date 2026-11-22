// A form sent the plain way (a full page load, no script of its own) gives no sign that anything is happening while
// the site answers, and a second press sends it twice. One listener in the layout covers every such form, so a new
// form needs nothing to get it. A form with its own script (`use:enhance`) stops the plain send itself, and shows its
// own busy button with its own words.

/** The id of the layout's hidden line that tells a screen reader a form is being sent. */
export const SENDING_NEWS = "sending-news";

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
  // The button's words stay as they are, so the wait is said out loud once, in the layout's hidden line.
  const news = document.getElementById(SENDING_NEWS);
  if (news !== null) news.textContent = "Sending…";
  setTimeout(() => {
    clearSending(form);
  }, TAKEN_FOR_MS);
}

/**
 * Takes the busy marks off a form and its buttons, or off every plain form this file marked: a page the browser brings
 * back from Back keeps them otherwise. Only forms and their buttons are touched, never a busy mark a screen set itself.
 */
export function clearSending(within: HTMLFormElement | Document = document): void {
  const forms =
    within instanceof HTMLFormElement ? [within] : [...within.querySelectorAll("form[aria-busy='true']")];
  for (const form of forms) {
    form.removeAttribute("aria-busy");
    for (const button of form.querySelectorAll("[aria-busy='true'][aria-disabled='true']")) {
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-disabled");
    }
  }
  const news = document.getElementById(SENDING_NEWS);
  if (news !== null) news.textContent = "";
}
