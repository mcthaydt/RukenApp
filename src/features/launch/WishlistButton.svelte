<!--
  Wishlist, where Play goes before launch (wishlist spec, "What a player sees before launch"): the day Ruken opens, then
  one button. One press puts the game on the person's list and the button reads "On your wishlist"; a second press takes
  it off. It is a plain form, so it works with no script: the site answers by sending the person back to the same page.
  With script the press is sent in the background and the button changes in place, with no new page. Someone signed
  out is sent to sign up, and comes back with the game on their list.
-->
<script lang="ts">
  import { goto } from "$app/navigation";

  interface Props {
    slug: string;
    /** Whether the game is on this person's list as the page was drawn. */
    wished: boolean;
    /** The words for the day Ruken opens. */
    opens: string;
    /** The page to come back to: the one this button is on. */
    back: string;
    /** The screen's own class for its main button, so Wishlist looks like the Play it stands in for. */
    buttonClass: string;
  }

  let { slug, wished, opens, back, buttonClass }: Props = $props();

  // Follows the page's answer until a press changes it here.
  let on = $derived(wished);
  let sending = $state(false);
  let problem = $state("");

  async function send(event: SubmitEvent & { currentTarget: HTMLFormElement }): Promise<void> {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    sending = true;
    problem = "";
    try {
      const answer = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
      });
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
      const said: { wished: boolean } | { go: string } = await answer.json();
      if ("go" in said) {
        await goto(said.go, { invalidateAll: true });
        return;
      }
      on = said.wished;
    } catch {
      problem = "That didn't work. Try again.";
    } finally {
      sending = false;
    }
  }
</script>

<form class="wish" method="POST" action={`/g/${slug}/wishlist`} onsubmit={send}>
  <input type="hidden" name="want" value={on ? "off" : "on"} />
  <input type="hidden" name="back" value={back} />
  <p class="opens">{opens}</p>
  <button class={buttonClass} disabled={sending} aria-busy={sending ? "true" : undefined}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </svg>
    <span>
      {#if sending}
        {on ? "Taking it off…" : "Adding it…"}
      {:else}
        {on ? "On your wishlist" : "Wishlist"}
      {/if}
    </span>
  </button>
  {#if problem !== ""}
    <p class="problem" role="alert">{problem}</p>
  {/if}
</form>

<style>
  .wish {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    pointer-events: auto;
  }
  .opens,
  .problem {
    margin: 0;
    font-weight: 600;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  svg {
    flex: none;
  }
</style>
