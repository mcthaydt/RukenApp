<!--
  Ask to playtest, under Wishlist on a game's page (playtesting spec): a → line that sends the ask at once, then "You
  asked…" with a → line to take it back. A plain form, so it works with no script (the site sends the person back to
  the same page); with script the press goes in the background and the lines change in place. Someone signed out is
  sent to sign up first, and comes back with the ask sent.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import type { PlaytestLook } from "./look.ts";
  import { PLAYTEST_WORDS } from "./words.ts";

  interface Props {
    slug: string;
    /** What this person sees of the game's playtest as the page was drawn: "ask" or "asked" draw something here. */
    look: PlaytestLook;
    /** The page to come back to: the one this is on. */
    back: string;
  }

  let { slug, look, back }: Props = $props();

  // Follows the page's answer until a press changes it here.
  let action = $derived(look.action);
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
      const said: { look: PlaytestLook } | { go: string } = await answer.json();
      if ("go" in said) {
        await goto(said.go, { invalidateAll: true });
        return;
      }
      action = said.look.action;
    } catch {
      problem = PLAYTEST_WORDS.failed;
    } finally {
      sending = false;
    }
  }
</script>

{#if action === "ask" || action === "asked"}
  <form class="playtestask" method="POST" action={`/g/${slug}/playtest`} onsubmit={send}>
    <input type="hidden" name="want" value={action === "ask" ? "on" : "off"} />
    <input type="hidden" name="back" value={back} />
    {#if action === "asked"}
      <p class="asked">{PLAYTEST_WORDS.asked}</p>
    {/if}
    <!-- Not `disabled` while it sends: a disabled button drops the keyboard's focus, and a second press is refused above. -->
    <button class="go" aria-disabled={sending ? "true" : undefined} aria-busy={sending ? "true" : undefined}
      >{action === "ask" ? PLAYTEST_WORDS.ask : PLAYTEST_WORDS.takeBack}</button
    >
    {#if problem !== ""}
      <p class="problem" role="alert">{problem}</p>
    {/if}
  </form>
{/if}
