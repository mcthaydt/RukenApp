<!--
  Where a game stands: its name over the state's headline, the one next step in a line, and the way back to Your
  games. The way back is the one blue button, in the bar on a phone like every other screen's buttons.
-->
<script lang="ts">
  let {
    name,
    headline,
    nextStep,
  }: {
    name: string;
    headline: string;
    /** The one next step, or null when there is nothing to do. */
    nextStep: string | null;
  } = $props();
</script>

<svelte:head>
  <title>Your game · Ruken</title>
</svelte:head>

<main>
  <p class="count">{name}</p>
  <h1>{headline}</h1>
  {#if nextStep !== null}
    <p>{nextStep}</p>
  {/if}
  <div class="acts">
    <a class="button" href="/make">Back to your games</a>
  </div>
</main>
