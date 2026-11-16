<!--
  A game its maker took off Ruken (spec 13.1 M2). Its name over "Taken off Ruken", the day it was taken off and what that
  means for players, then the one blue button that undoes it: "Put it back on Ruken" copies the newest files from GitHub
  and sends them for review, so the game waits for a person's yes like a new one. While it copies, the button says so and
  cannot be pressed twice, as Live's "Send a new version" does. When deleting its files stopped halfway, a card below says
  some are still on Ruken, with its own red button to delete them, under the blue button's note so each button has its own line.
-->
<script lang="ts">
  import { enhance } from "$app/forms";

  let {
    name,
    line,
    filesLeft,
    problem,
  }: {
    name: string;
    /** "You took it off on 12 December. Players can't find it." */
    line: string;
    /** True when some of its files are still in the bucket. */
    filesLeft: boolean;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would copy twice.
  let copying = $state(false);
  let deleting = $state(false);
</script>

<svelte:head>
  <title>Taken off Ruken · Ruken</title>
</svelte:head>

<main data-state>
  <p class="count">{name}</p>
  <h1>Taken off Ruken</h1>
  <p>{line}</p>
  {#if problem !== undefined}
    <p class="problem" role="alert">{problem}</p>
  {/if}
  <form
    method="POST"
    action="?/putBack"
    use:enhance={({ cancel }) => {
      if (copying) cancel();
      copying = true;
      return async ({ update }) => {
        await update();
        copying = false;
      };
    }}
  >
    <div class="acts">
      <button disabled={copying} aria-busy={copying ? "true" : undefined}>
        {copying ? "Copying your game…" : "Put it back on Ruken"}
      </button>
    </div>
    <p class="note">
      {#if copying}
        Copying your game can take a minute. Keep this page open.
      {:else}
        Copies the newest version of your game from GitHub and sends it for review.
      {/if}
    </p>
  </form>
  {#if filesLeft}
    <div class="sheet fix">
      <p class="say">Some of its files are still on Ruken.</p>
      <form
        method="POST"
        action="?/deleteLeft"
        use:enhance={({ cancel }) => {
          if (deleting) cancel();
          deleting = true;
          return async ({ update }) => {
            await update();
            deleting = false;
          };
        }}
      >
        <button class="danger" disabled={deleting}>Delete them</button>
      </form>
    </div>
  {/if}
  <a class="foot" href="/make">Back to your games</a>
</main>
