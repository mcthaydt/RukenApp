<!--
  Where a game stands: its name over the state's headline, the one next step in a line, and the way back to Your
  games. The way back is the one blue button, in the bar on a phone like every other screen's buttons. On a wide window it
  starts at the top left, where Live and Waiting start, not in the middle of the window.
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

<main data-state>
  <p class="count">{name}</p>
  <h1>{headline}</h1>
  {#if nextStep !== null}
    <p>{nextStep}</p>
  {/if}
  <div class="acts">
    <a class="button" href="/make">Back to your games</a>
  </div>
</main>
