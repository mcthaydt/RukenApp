<!--
  The paywall card: what it costs and what happens next, in two lines; two plans; one button. Signed out the
  button leads to sign-up and is plain ink; signed in it is the pip-red "Continue to payment", the one press in the
  whole site that spends money, so the one red thing. "Not now" is the way back. A member who opens the card is
  told so and sent on. Someone whose card failed more than seven days ago is told so, with one "Update card" button
  to Stripe's page, in place of the price (paywall.ts).
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // After a refusal the card keeps the plan that was chosen; on a first visit it is the one in the address.
  let plan = $derived(form?.plan ?? data.plan);
</script>

<svelte:head>
  <title>Join Ruken to play · Ruken</title>
</svelte:head>

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
    <p><a href="/">Not now</a></p>
  {:else}
    <h1>Join Ruken to play</h1>
    <p>{data.prices.monthly} a month, or {data.prices.annual} a year. Tax is added where it applies.</p>
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
          <input type="radio" name="plan" value="monthly" checked={plan === "monthly"} />
          {data.prices.monthly} a month
        </label>
        <label class="choice">
          <input type="radio" name="plan" value="annual" checked={plan === "annual"} />
          {data.prices.annual} a year
        </label>
      </div>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      {#if data.signedIn}
        <button class="pay">Continue to payment</button>
      {:else}
        <button>Continue</button>
      {/if}
    </form>
    <p><a href="/">Not now</a></p>
  {/if}
</main>
