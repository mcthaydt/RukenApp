<!--
  The paywall card: what it costs and what happens next, in two lines; two plans; one button, the main blue one.
  Signed out it leads to sign-up; signed in it is "Continue to payment". "Not now" is the way back. A member who opens the card is
  told so and sent on. Someone whose card failed more than seven days ago is told so, with one "Update card" button
  to Stripe's page, in place of the price (paywall.ts).
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

<main class="card">
  {#if data.card.kind === "member"}
    <h1>You're already a member.</h1>
    <p><a class="button" href={data.next}>Keep playing</a></p>
  {:else if data.card.kind === "paused"}
    <h1>Your membership is paused</h1>
    <p>{data.card.line}</p>
    <!-- The same Stripe page /me opens, where the member changes their card. -->
    <form method="POST" action="/me?/portal">
      <button>Update card</button>
    </form>
    <p><a href={data.notNow}>Not now</a></p>
  {:else}
    <h1>Join Ruken to play</h1>
    <p>Tax is added where it applies.</p>
    <p>Renews until you cancel. You can cancel any time from your account.</p>
    {#if data.signedIn}
      <p>You pay on the next page, then come straight back.</p>
    {:else}
      <!-- Signed out, the next page is sign-up, so the steps are said in the order they happen. -->
      <p>First you make an account, then you pay. Then you come straight back.</p>
    {/if}
    <form method="POST" action="?/join">
      <input type="hidden" name="next" value={data.next} />
      <!-- Two rows, each a real radio button in a label the width of the card, so the whole row is the target. -->
      <div role="radiogroup" aria-label="Plan">
        <label class="choice">
          <input type="radio" name="plan" value="monthly" bind:group={chosen.plan} />
          {data.prices.monthly} a month
        </label>
        <label class="choice">
          <input type="radio" name="plan" value="annual" bind:group={chosen.plan} />
          {data.prices.annual} a year
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
    <p><a href={data.notNow}>Not now</a></p>
  {/if}
</main>
