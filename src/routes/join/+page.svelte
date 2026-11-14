<!--
  The paywall card: what it costs and what happens next, in two lines; two plans; one button. Signed out the
  button leads to sign-up and is plain ink; signed in it is the pip-red "Continue to payment", the one press in the
  whole site that spends money, so the one red thing. "Not now" is the way back. A member who opens the card is
  told so and sent on.
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
  {#if data.member}
    <h1>You're already a member.</h1>
    <p><a class="button" href={data.next}>Keep playing</a></p>
  {:else}
    <h1>Join Ruken to play</h1>
    <p>{data.prices.monthly} a month, or {data.prices.annual} a year. Tax is added where it applies.</p>
    <p>You pay on the next page, then come straight back.</p>
    <form method="POST" action="?/join">
      <input type="hidden" name="next" value={data.next} />
      <p>
        <label>
          <input type="radio" name="plan" value="monthly" checked={plan === "monthly"} />
          Monthly {data.prices.monthly} a month
        </label>
      </p>
      <p>
        <label>
          <input type="radio" name="plan" value="annual" checked={plan === "annual"} />
          Yearly {data.prices.annual} a year
        </label>
      </p>
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
