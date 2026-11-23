<!--
  The paywall card: a bold card in two halves. Its top is a band of Dusky Green with a big title and what a member gets
  (with no surface of its own when the game the person tapped plays behind it, so the game shows through the dim); the other half, on
  paper, holds the two plans as big rows, the one blue button and the small print (what it costs and what happens
  next). On a computer the two halves sit side by side. Signed out the button leads to sign-up; signed in it is "Continue to payment". "Not now" is the way
  back: a close mark in the band's corner, as an app's sheet has, with its words for a screen reader (the owner,
  2026-11-22: an icon on its own wherever people understand it, and no underlined words as buttons). A member who opens
  the card is told so and sent on. Someone whose card failed more than seven days ago is told so, with one "Update card"
  button to Stripe's page, in place of the price (paywall.ts).
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import { onMount } from "svelte";
  import { quietVideo } from "../../lib/quiet-video.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // The plan the card opens on: after a refusal the one that was chosen, on a first visit the one in the address.
  // It is state bound to the two radio buttons, not a value written onto them. When the page comes alive, Svelte
  // reads a choice the person made a moment before, on the page as the server sent it; setting `checked` from a
  // value instead writes the opening plan back over it, and a person on a slow phone loses the plan they picked.
  // It is a property of one object, so the two bindings below are all that read it: the form posts the buttons' own state.
  // svelte-ignore state_referenced_locally
  let chosen = $state({ plan: form?.plan ?? data.plan });

  // Whether the plans were last moved by the keyboard. The ring round a plan row is the keyboard's alone: a press or a
  // click shows the chosen row turning ink and needs no ring. WebKit drops :focus-visible when an arrow key moves to the
  // next plan (measured on the phone), so the arrow keys' ring is drawn from this instead.
  let keys = $state(false);

  // The clip behind the card is the shape of the window: upright until the page is alive and says otherwise.
  let wide = $state(false);
  onMount(() => {
    const landscape = matchMedia("(orientation: landscape)");
    wide = landscape.matches;
    const follow = () => {
      wide = landscape.matches;
    };
    landscape.addEventListener("change", follow);
    return () => {
      landscape.removeEventListener("change", follow);
    };
  });
</script>

<svelte:window onkeydown={() => (keys = true)} onpointerdown={() => (keys = false)} />

{#if data.backdrop !== null}
  <!-- The game they tapped, dimmed, behind the card. It takes no press and no focus, and a screen reader does not meet it. -->
  <div class="behindcard" aria-hidden="true">
    <!-- Remounted when the shape changes, so the new clip is started by quietVideo too. -->
    {#key wide}
      <video
        use:loads
        src={wide ? data.backdrop.wide : data.backdrop.upright}
        preload="metadata"
        tabindex="-1"
        muted
        loop
        playsinline
        use:quietVideo
      ></video>
    {/key}
  </div>
{/if}

<main class="card bold">
  {#snippet close()}
    <!-- Not now: the close mark. Its name is its words, so a screen reader and the journeys read "Not now". -->
    <a class="close" href={data.notNow} aria-label="Not now">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </a>
  {/snippet}
  {#if data.card.kind === "member"}
    <div class="cardtop">
      <h1>You're already a member.</h1>
    </div>
    <div class="cardbody">
      <p><a class="button" href={data.next}>Keep playing</a></p>
    </div>
  {:else if data.card.kind === "paused"}
    <div class="cardtop">
      {@render close()}
      <h1>Your membership is paused</h1>
    </div>
    <div class="cardbody">
      <p>{data.card.line}</p>
      <!-- The same Stripe page /me opens, where the member changes their card. -->
      <form method="POST" action="/me?/portal">
        <button>Update card</button>
      </form>
    </div>
  {:else}
    <div class="cardtop">
      <!-- The close mark and the title share a row, so the title's lines wrap round the mark; what a member gets sits at the
           foot of the top, however tall the window makes it. -->
      <div class="titlerow">
        {@render close()}
        <h1>Join Ruken to play</h1>
      </div>
      <!-- What a member gets, each a short line with a tick: the owner's own list (2026-11-22). -->
      <ul class="gets">
        <li>Every game on Ruken</li>
        <li>No ads</li>
        <li>On your phone or computer</li>
      </ul>
    </div>
    <div class="cardbody">
      <form method="POST" action="?/join">
        <input type="hidden" name="next" value={data.next} />
        <!-- Two big rows, each a real radio button (hidden from sight, with Ruken's own mark beside it) in a label the width of the card, so the whole row is the target. The
             price is in the display face, the size of a heading, so it is the first thing read. -->
        <div role="radiogroup" aria-label="Plan" class="plans" data-keys={keys ? "" : undefined}>
          <label class="plan">
            <input type="radio" name="plan" value="monthly" bind:group={chosen.plan} />
            <span class="mark" aria-hidden="true"></span>
            <span class="price">{data.prices.monthly}</span> a month
          </label>
          <label class="plan">
            <input
              type="radio"
              name="plan"
              value="annual"
              bind:group={chosen.plan}
              aria-describedby={data.prices.annualSaves === null ? undefined : "yearly-saves"}
            />
            <span class="mark" aria-hidden="true"></span>
            <span class="price">{data.prices.annual}</span> a year
            {#if data.prices.annualSaves !== null}
              <!-- Read once, as the yearly row's description, so the row's name stays its price. -->
              <span class="saves" id="yearly-saves" aria-hidden="true">Save {data.prices.annualSaves}</span>
            {/if}
          </label>
        </div>
        {#if form?.error}
          <p class="problem" role="alert">{form.error}</p>
        {/if}
        {#if data.signedIn}
          <button>Continue to payment</button>
        {:else}
          <button>Continue</button>
        {/if}
      </form>
      <div class="small">
        <p>Tax is added where it applies.</p>
        <p>Renews until you cancel. You can cancel any time from your account.</p>
        {#if data.signedIn}
          <p>You pay on the next page, then come straight back.</p>
        {:else}
          <!-- Signed out, the next page is sign-up, so the steps are said in the order they happen. -->
          <p>First you make an account, then you pay. Then you come straight back.</p>
        {/if}
      </div>
      <!-- What is Ruken? (the landing page's link goes here once /about is on main) -->
    </div>
  {/if}
</main>
