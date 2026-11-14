<!--
  Between paying and Stripe's news reaching the site. The person does nothing here: the page asks again every two
  seconds and goes on by itself the moment the membership exists. If that takes more than thirty seconds it says
  the money is safe and gives one place to go. The asking is a timer, not motion: nothing here moves.
-->
<script lang="ts">
  import { refreshAll } from "$app/navigation";
  import { onMount } from "svelte";

  const ASK_EVERY_MS = 2000;
  /** Fifteen asks, two seconds apart: thirty seconds. */
  const ASKS_BEFORE_SLOW = 15;

  let slow = $state(false);

  onMount(() => {
    let asked = 0;
    const timer = setInterval(() => {
      asked += 1;
      if (asked >= ASKS_BEFORE_SLOW) slow = true;
      void refreshAll();
    }, ASK_EVERY_MS);
    // The timer stops when the page is left.
    return () => {
      clearInterval(timer);
    };
  });
</script>

<svelte:head>
  <title>Finishing up · Ruken</title>
</svelte:head>

<main class="card">
  {#if slow}
    <h1>This is taking longer than usual.</h1>
    <p>Your payment went through. Your membership will show on your account in a minute.</p>
    <p><a class="button" href="/me">Go to my account</a></p>
  {:else}
    <h1>Finishing up…</h1>
    <p>Your payment went through. One moment.</p>
  {/if}
</main>
