<!--
  The Following tab (FeedTop.svelte): the games of makers the person follows. Following a maker is not built yet, so
  for now it says how to get here: sign in, or, signed in, that the person follows nobody yet, with a way back to every
  game. The top bar stays, so For you is one press away.
-->
<script lang="ts">
  import FeedTop from "./FeedTop.svelte";

  let { signedIn }: { signedIn: boolean } = $props();
</script>

<FeedTop on="following" />

<main class="empty">
  {#if signedIn}
    <p class="statement">You don't follow anyone yet.</p>
    <p>When you follow a maker, their games show up here.</p>
    <a class="button" href="/">See every game</a>
  {:else}
    <p class="statement">Sign in to see games from makers you follow.</p>
    <a class="button" href="/sign-in?next=%2Ffollowing">Sign in</a>
  {/if}
</main>

<style>
  .empty {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    width: auto;
    min-height: 100dvh;
    margin: 0;
    padding: 5rem 1rem 6rem;
    text-align: center;
  }
  .empty p {
    max-width: 22rem;
    margin: 0;
  }
</style>
