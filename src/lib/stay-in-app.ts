// A form sent the plain way makes the browser load a whole new page: the screen goes blank for a moment, as a
// website does, and never as an app does (the owner, 2026-11-22: "we should almost never have page reload
// transitions because that's jarring"). One listener in the layout sends every such form from inside the page
// instead, with SvelteKit's own `enhance`, so the answer comes in as the rest of the app's pages do. A new form needs
// nothing to get it, and without a script a form still works the plain way. A form with its own script
// (`use:enhance`) stops the plain send itself and is left alone.
import { enhance } from "$app/forms";
import { clearSending } from "./busy-forms.ts";

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
    return async ({ result, update }) => {
      try {
        await update();
        // An answer on the same page leaves no password in its box, as a fresh page would. A next step (the form
        // gave way to another screen) starts at its top; an answer in place (a refusal, a line moved up) keeps the
        // person where they pressed, as an app does.
        if (result.type === "success" || result.type === "failure") {
          for (const box of form.querySelectorAll<HTMLInputElement>("input[type='password']")) box.value = "";
          if (!form.isConnected) window.scrollTo(0, 0);
        }
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
