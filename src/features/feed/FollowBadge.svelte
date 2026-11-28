<!--
  The plus over a maker's picture on a feed clip (maker-credit-and-follow spec): one press follows the maker and the
  plus turns into a check; pressing the check unfollows. It is a plain form, so it works with no script: the site
  follows or unfollows and sends the person back to the feed. With script the press is sent in the background and the
  badge changes in place. Someone signed out is sent to sign up, and comes back following the maker.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { followsChanged } from "./kept.svelte.ts";

  interface Props {
    handle: string;
    name: string;
    /** Whether the person follows this maker, as the feed knows it now. */
    following: boolean;
    /** The page to come back to: the one this badge is on. */
    back: string;
  }

  let { handle, name, following, back }: Props = $props();

  /** How long "That didn't work" stays under the name. */
  const PROBLEM_MS = 4000;

  let sending = $state(false);
  let problem = $state(false);
  let problemTimer: ReturnType<typeof setTimeout> | undefined;

  async function send(event: SubmitEvent & { currentTarget: HTMLFormElement }): Promise<void> {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    sending = true;
    problem = false;
    clearTimeout(problemTimer);
    try {
      const answer = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
      });
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
      const said: { following: boolean } | { go: string } = await answer.json();
      if ("go" in said) {
        await goto(said.go, { invalidateAll: true });
        return;
      }
      // Every clip by this maker changes with it, on this tab and on the others (kept.svelte.ts).
      void followsChanged(handle, said.following);
    } catch {
      // The badge was never changed ahead of the answer, so it already shows how things are.
      problem = true;
      problemTimer = setTimeout(() => {
        problem = false;
      }, PROBLEM_MS);
    } finally {
      sending = false;
    }
  }
</script>

<form class="follow" method="POST" action={`/${handle}/follow`} onsubmit={send}>
  <input type="hidden" name="want" value={following ? "off" : "on"} />
  <input type="hidden" name="back" value={back} />
  <!-- Not `disabled` while it sends: a disabled button drops the keyboard's focus, and a second press is refused above. -->
  <button
    class:on={following}
    aria-label={`Follow ${name}`}
    aria-pressed={following ? "true" : "false"}
    aria-disabled={sending ? "true" : undefined}
    aria-busy={sending ? "true" : undefined}
  >
    <span class="dot">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        {#if following}
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        {:else}
          <path d="M12 5v14M5 12h14" />
        {/if}
      </svg>
    </span>
  </button>
</form>
{#if problem}
  <p class="problem" role="alert">That didn't work. Try again.</p>
{/if}

<style>
  .follow {
    position: absolute;
    top: calc(var(--photo) - var(--size-target) / 2);
    left: 50%;
    margin: 0;
    transform: translateX(-50%);
    pointer-events: auto;
  }
  /* The pressable area is the full target size; the badge drawn in it is small, over the picture's bottom edge. */
  button {
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    padding: 0;
    border: 0;
    border-radius: 50%;
    --corner: round;
    background: none;
    color: var(--chalk);
  }
  /* The site's form rules put a step and a half above a form's button (after the hidden fields); here that would push the
     plus down onto the name, so this one keeps none. */
  .follow > button {
    margin: 0;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-pay);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .on .dot {
    background: var(--glass-safe);
  }
  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  button:focus-visible {
    outline-color: var(--chalk);
  }
  .problem {
    margin: 0.25rem 0 0;
    max-width: 6rem;
    font: var(--text-small);
    font-weight: 600;
    text-align: center;
    color: var(--chalk);
    text-shadow: var(--glass-ink);
  }
</style>
