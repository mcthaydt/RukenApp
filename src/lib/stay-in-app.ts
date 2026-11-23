// A form sent the plain way makes the browser load a whole new page: the screen goes blank for a moment, as a
// website does, and never as an app does (the owner, 2026-11-22: "we should almost never have page reload
// transitions because that's jarring"). One listener in the layout sends every such form from inside the page
// instead, with SvelteKit's own `enhance`, so the answer comes in as the rest of the app's pages do. A new form needs
// nothing to get it, and without a script a form still works the plain way. A form with its own script
// (`use:enhance`) stops the plain send itself and is left alone.
import { enhance } from "$app/forms";
import { goto } from "$app/navigation";
import { clearSending } from "./busy-forms.ts";

/** The words of the screen's main heading, which change when an answer brings the next step. */
function headingNow(): string | null {
  return document.querySelector("h1")?.textContent ?? null;
}

/** Whether an address is the page the person is on now. */
function isThisPage(address: string): boolean {
  const there = new URL(address, location.href);
  return (
    there.origin === location.origin && there.pathname + there.search === location.pathname + location.search
  );
}

/** Sends a plain POST form from inside the page, the way `use:enhance` would, and frees its button after. */
export function sendInApp(event: SubmitEvent): void {
  if (event.defaultPrevented) return;
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
  const method = submitter?.getAttribute("formmethod") ?? form.getAttribute("method") ?? "get";
  if (method.toLowerCase() !== "post") return;
  event.preventDefault();
  // `enhance` listens for the form's own submit, so it is put on for this one send and the form is sent again,
  // through it. It stops that second send itself, so the plain one never happens. The browser ignores a send asked
  // for while it is still telling everyone about this one, so the second send waits a turn.
  // While this send is out, `enhance` would take a second press as a send of its own, before the layout's busy mark
  // could stop it; so it sends once and stops any press after.
  let alreadySent = false;
  const enhanced = enhance(form, ({ cancel }) => {
    if (alreadySent) {
      cancel();
      return;
    }
    alreadySent = true;
    const headingBefore = headingNow();
    return async ({ result, update }) => {
      try {
        // An answer that sends the person back to the page they are on (Up and Down on Your links, the player count
        // switch) is brought in where the person is: the page is loaded again, an earlier refusal goes, as it would
        // with a fresh page, and the scroll and focus are left alone (`reset: false`). The heading rule below still
        // takes a screen that became another one ("You're in." to Live) to its top.
        if (result.type === "redirect" && isThisPage(result.location)) {
          HTMLFormElement.prototype.reset.call(form);
          await goto(result.location, { refreshAll: true, reset: false, replace: true });
        } else {
          await update();
        }
        // An answer leaves no password in its box, as a fresh page would. A next step (the screen's heading changed,
        // as from "Join Ruken" to "We texted you a code") starts at its top; an answer in place (a refusal, a line
        // moved up) keeps the person where they pressed, as an app does. A move to another page went to its top
        // already.
        for (const box of form.querySelectorAll<HTMLInputElement>("input[type='password']")) box.value = "";
        if (result.type !== "error" && headingNow() !== headingBefore) window.scrollTo(0, 0);
      } finally {
        clearSending(form);
        enhanced.destroy();
      }
    };
  });
  setTimeout(() => {
    form.requestSubmit(submitter);
  }, 0);
}
