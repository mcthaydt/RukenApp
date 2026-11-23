<!--
  The cookie notice (design 3.4), in two shapes: a frosted card at the bottom of every screen until the browser
  chooses, and, on /cookies, the whole screen's one card (sent there by a button that needs the yes).
  "I agree" is a plain form that works before scripts load; with scripts it does not reload the screen.
  "Not now" sends nothing and stores nothing: on the card it hides the card until the next visit.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { setAgreed } from "./device-store.ts";

  type Reason = "sign-in" | "sign-up" | "join" | "play" | "save" | "account";

  let {
    reason = null,
    next,
    from,
    card = false,
    aboveBar = false,
    onNotNow,
  }: {
    /** What was pressed, when a button that needs the yes sent the person here. */
    reason?: Reason | null;
    /** Where "I agree" goes on to. */
    next: string;
    /** The page the notice was opened on, so a yes keeps the maker who brought the person. */
    from: string;
    /** The small card at the bottom of a screen, not the screen's own card. */
    card?: boolean;
    /** The bar of Home and You is on this screen, so the card sits above it. */
    aboveBar?: boolean;
    onNotNow: () => void;
  } = $props();

  const WHY: Record<Reason, string> = {
    "sign-in": "To sign in, Ruken needs to keep a few small things in your browser.",
    "sign-up": "To make an account, Ruken needs to keep a few small things in your browser.",
    join: "To join, Ruken needs to keep a few small things in your browser.",
    play: "To play, Ruken needs to keep a few small things in your browser.",
    save: "To save this game, Ruken needs to keep a few small things in your browser.",
    account: "To go on, Ruken needs to keep a few small things in your browser.",
  };

  let sending = $state(false);

  /** "Not now" on the notice's own screen leaves it: to the Ruken page the person came from, or the feed. Never back to another website. */
  function leave(event: MouseEvent): void {
    event.preventDefault();
    const target = new URL(from, "https://ruken.invalid");
    const wanted = new URL(next, "https://ruken.invalid");
    const stays = from.startsWith("/") && !from.startsWith("//") && target.pathname !== wanted.pathname;
    void goto(stays ? from : "/");
  }
</script>

{#snippet answer()}
  <form
    method="POST"
    action="/cookies?/agree"
    use:enhance={() => {
      sending = true;
      return async ({ update }) => {
        setAgreed(true);
        await update();
        sending = false;
      };
    }}
  >
    <input type="hidden" name="next" value={next} />
    <input type="hidden" name="from" value={from} />
    <button disabled={sending} aria-busy={sending}>I agree</button>
  </form>
{/snippet}

{#if card}
  <aside class="consent" class:above-bar={aboveBar} aria-labelledby="consent-title">
    <h2 id="consent-title">Cookies?</h2>
    <p>
      To sign you in, let you play and thank the maker who sent you, Ruken keeps a few small things in your
      browser. We keep nothing until you say yes.
    </p>
    <p>No ads. We never sell your data.</p>
    <div class="consent-answers">
      {@render answer()}
      <button type="button" class="safe" onclick={onNotNow}>Not now</button>
    </div>
    <p class="note"><a href="/privacy">What we keep</a></p>
  </aside>
{:else}
  <main class="card">
    <h1>Cookies?</h1>
    {#if reason !== null}
      <p>{WHY[reason]}</p>
    {/if}
    <p>
      To sign you in, let you play and thank the maker who sent you, Ruken keeps a few small things in your
      browser. We keep nothing until you say yes.
    </p>
    <p>No ads. We never sell your data.</p>
    <div class="consent-answers">
      {@render answer()}
      <a class="button safe" href="/" onclick={leave}>Not now</a>
    </div>
    <p class="note"><a href="/privacy">What we keep</a></p>
  </main>
{/if}
