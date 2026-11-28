<!--
  The cookie notice (design 3.4), in two shapes: a small card at the bottom of every screen until the browser
  chooses, which the screen above always keeps clear of, and, on /cookies, the whole screen's one card (sent there by a button that needs the yes).
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
    aboveBar = false,
    onNotNow,
    onAgreed,
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
  let cardBox = $state<HTMLElement>();

  // The card never covers a button of the screen under it (the owner's rule: no two controls ever overlap). It tells the
  // page how much of the window's foot it takes, with a line of air, as --consent-room; the screen's view ends above it
  // (src/lib/look.css). Measured, since its height changes with the window, the words and the why line.
  $effect(() => {
    const box = cardBox;
    // Moving above the bar or off it changes where the card stands but not its size, so that is watched too.
    void aboveBar;
    if (box === undefined) return;
    const root = document.documentElement;
    const measure = () => {
      const room = Math.ceil(innerHeight - box.getBoundingClientRect().top + 8);
      root.style.setProperty("--consent-room", `${String(Math.max(room, 0))}px`);
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(box);
    addEventListener("resize", measure);
    return () => {
      watcher.disconnect();
      removeEventListener("resize", measure);
      root.style.removeProperty("--consent-room");
    };
  });

  // A press that needs the yes opened the card: "I agree" takes the keyboard's focus, so the card is the next thing a
  // person who pressed with the keyboard reaches (Tab never gets past a feed that never ends).
  $effect(() => {
    if (card && reason !== null) agreeButton?.focus();
  });

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
  <!-- Small, so the screen keeps most of the window: the question, its one line, the two answers, and What we keep
       beside the question. The whole story is on What we keep, and on the notice's own screen. -->
  <aside bind:this={cardBox} class="consent" class:above-bar={aboveBar} aria-labelledby="consent-title">
    <div class="consent-top">
      <h2 id="consent-title">Cookies?</h2>
      <a class="go" href="/privacy">What we keep</a>
    </div>
    {#if reason !== null}
      <p class="why">{WHY[reason]}</p>
    {:else}
      <p>We save a few small things in your browser. Nothing is saved until you say yes.</p>
    {/if}
    <div class="consent-answers">
      {@render answer()}
      <button type="button" class="safe" onclick={onNotNow}>Not now</button>
    </div>
  </aside>
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
