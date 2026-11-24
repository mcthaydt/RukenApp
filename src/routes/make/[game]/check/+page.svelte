<!--
  Check and send, the last step: "Last step" over the heading, the one blue button, and beside them the game laid out as
  members will see it, with a Change on each part. A Test play button beside the blue one plays the files first. With script, a press says it is sending and cannot be pressed twice.
  Two halves on a wide window, stacked on a narrow one with the button in the bar (spec 15.2).
  Sending cannot be taken back by the maker herself, so only a press on the button sends: there is no "press Enter" hint here.
  A game that was sent already (it waits for review) is changed here instead: what is changed is saved at once, so the
  screen says so, has nothing to send, and a blue "Done" goes back to Waiting.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import GameLaidOut from "../../parts/GameLaidOut.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // True from the press until the answer comes: a second press while the first is out would send twice.
  let sending = $state(false);
</script>

<main class="halves checking">
  {#if data.changing}
    <div>
      <p class="count">{data.name}</p>
      <h1>Change something</h1>
      <p>Your changes are saved. Staff see them.</p>
      <div class="acts">
        <a class="button" href={data.doneAddress}>Done</a>
        {#if data.testPlay !== null}
          <a class="button outline" data-sveltekit-preload-data="off" href={data.testPlay}>Test play</a>
        {/if}
      </div>
    </div>
  {:else}
    <form
      method="POST"
      action="?/send"
      use:enhance={({ cancel }) => {
        if (sending) cancel();
        sending = true;
        return async ({ update }) => {
          await update();
          sending = false;
        };
      }}
    >
      <p class="count">Last step</p>
      <h1>Check it, then send</h1>
      {#if form?.problem !== undefined}
        <p class="problem" role="alert">{form.problem}</p>
      {/if}
      <!-- Every game plays on both, so this is said once, above the button, and never asked. -->
      <p class="note">Your game must work on phones and computers.</p>
      <div class="acts">
        <button disabled={sending} aria-busy={sending ? "true" : undefined}> Send for review </button>
        {#if data.testPlay !== null}
          <a class="button outline" data-sveltekit-preload-data="off" href={data.testPlay}>Test play</a>
        {/if}
      </div>
    </form>
  {/if}
  <GameLaidOut game={data.game} />
</main>
{#if data.throwAway !== null}
  <a class="foot" href={data.throwAway}>Throw this game away</a>
{/if}
