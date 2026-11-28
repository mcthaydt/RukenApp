<!--
  The cookie notice (design 3.4), in two shapes: a card in front of every screen until the browser chooses, the
  screen dimmed behind it and taking no press until an answer (so the card never sits on one of its buttons), and, on
  /cookies, the whole screen's one card (sent there by a button that needs the yes).
  "I agree" is a plain form that works before scripts load; with scripts it does not reload the screen.
  "Not now" sends nothing and stores nothing: on the card it hides the card until the next visit.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { setAgreed } from "./device-store.ts";

  type Reason = "sign-in" | "sign-up" | "join" | "play" | "save" | "like" | "repost" | "follow" | "account";

  let {
    reason = null,
    next,
    from,
    card = false,
    onNotNow,
    onAgreed,
  }: {
    /** What was pressed, when a button that needs the yes sent the person here. */
    reason?: Reason | null;
    /** Where "I agree" goes on to. */
    next: string;
    /** The page the notice was opened on, so a yes keeps the maker who brought the person. */
    from: string;
    /** The card in front of a screen, not the screen's own card. */
    card?: boolean;
    onNotNow: () => void;
    /** Runs once "I agree" has been kept, on the same screen (a press that waited for the yes). */
    onAgreed?: () => void;
  } = $props();

  const WHY: Record<Reason, string> = {
    "sign-in": "To sign in, Ruken needs to keep a few small things in your browser.",
    "sign-up": "To make an account, Ruken needs to keep a few small things in your browser.",
    join: "To join, Ruken needs to keep a few small things in your browser.",
    play: "To play, Ruken needs to keep a few small things in your browser.",
    save: "To save this game, Ruken needs to keep a few small things in your browser.",
    like: "To like this game, Ruken needs to keep a few small things in your browser.",
    repost: "To repost this game, Ruken needs to keep a few small things in your browser.",
    follow: "To follow this maker, Ruken needs to keep a few small things in your browser.",
    account: "To go on, Ruken needs to keep a few small things in your browser.",
  };

  let sending = $state(false);
  let agreeButton = $state<HTMLButtonElement>();

  // A press that needs the yes opened the card: "I agree" takes the keyboard's focus, so the card is the next thing a
  // person who pressed with the keyboard reaches (Tab never gets past a feed that never ends).
  $effect(() => {
    if (card && reason !== null) agreeButton?.focus();
  });

  // The card is a dialog that holds the screen until an answer: everything behind it takes no press and no focus, so
  // nothing of the page is ever under a button of the card, and the pad and Tab stay on its answers. It is drawn open
  // from the server, so it asks before scripts load; once they have, it is opened again as the screen's one question.
  // Escape is Not now.
  let cardBox = $state<HTMLDialogElement>();
  $effect(() => {
    const box = cardBox;
    if (box === undefined || box.matches(":modal")) return;
    box.close();
    box.showModal();
    // Opening it puts the focus on I agree, which would draw its ring for a tap; the card itself holds the focus, so
    // the first Tab or move of the pad lands on I agree. A press that needs the yes still focuses I agree (above).
    if (reason === null) box.focus();
  });

  function escaped(event: Event): void {
    event.preventDefault();
    onNotNow();
  }

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
        onAgreed?.();
      };
    }}
  >
    <input type="hidden" name="next" value={next} />
    <input type="hidden" name="from" value={from} />
    <button bind:this={agreeButton} disabled={sending} aria-busy={sending}>I agree</button>
  </form>
{/snippet}

{#if card}
  <dialog
    bind:this={cardBox}
    class="consent"
    aria-labelledby="consent-title"
    tabindex="-1"
    open
    oncancel={escaped}
  >
    <h2 id="consent-title">Cookies?</h2>
    {#if reason !== null}
      <p class="why">{WHY[reason]}</p>
    {/if}
    <p>
      We save a few small things in your browser. They keep you signed in, let you play and thank the maker
      who sent you. Nothing is saved until you say yes.
    </p>
    <p>No ads. We never sell your data.</p>
    <div class="consent-answers">
      {@render answer()}
      <button type="button" class="safe" onclick={onNotNow}>Not now</button>
    </div>
    <p class="note"><a class="go" href="/privacy">What we keep</a></p>
  </dialog>
{:else}
  <main class="card">
    <h1>Cookies?</h1>
    {#if reason !== null}
      <p>{WHY[reason]}</p>
    {/if}
    <p>
      We save a few small things in your browser. They keep you signed in, let you play and thank the maker
      who sent you. Nothing is saved until you say yes.
    </p>
    <p>No ads. We never sell your data.</p>
    <div class="consent-answers">
      {@render answer()}
      <a class="button safe" href="/" onclick={leave}>Not now</a>
    </div>
    <p class="note"><a class="go" href="/privacy">What we keep</a></p>
  </main>
{/if}
