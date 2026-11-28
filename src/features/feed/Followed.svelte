<!--
  The Followed tab (FeedTop.svelte): the live games of the makers the person follows, played just like the feed (the
  same screen, with this tab marked), ending after the last one. With none to show it says why, with one way on: sign
  in, or, signed in, that the person follows nobody yet or that the makers they follow have nothing live, with a way
  back to every game. The top bar stays, so Fresh is one press away.
-->
<script lang="ts">
  import Feed from "./Feed.svelte";
  import FeedTop from "./FeedTop.svelte";
  import type { FeedPage } from "./service.ts";
  import type { Friend } from "../sends/sends.browser.ts";

  let props:
    | { signedIn: false }
    | {
        signedIn: true;
        /** How many makers the person follows. */
        following: number;
        first: FeedPage;
        launch: { before: false } | { before: true; opens: string; wished: string[] };
        /** Friends sent games the person has not looked at: the dot on the Your turn tab. */
        news: boolean;
        friends: readonly Friend[];
      } = $props();
</script>

{#if props.signedIn && props.first.clips.length > 0}
  <Feed first={props.first} launch={props.launch} tab="followed" news={props.news} friends={props.friends} />
{:else}
  <FeedTop on="followed" news={props.signedIn && props.news} />

  <main class="empty">
    {#if props.signedIn && props.following === 0}
      <p class="statement">You don't follow anyone yet.</p>
      <p>Press the plus by a maker to follow them, and their games show up here.</p>
      <a class="button" href="/">See every game</a>
    {:else if props.signedIn}
      <p class="statement">No games here yet.</p>
      <p>The makers you follow have nothing to play right now.</p>
      <a class="button" href="/">See every game</a>
    {:else}
      <p class="statement">Sign in to see games from makers you follow.</p>
      <a class="button" href="/sign-in?next=%2Ffollowed">Sign in</a>
    {/if}
  </main>
{/if}

<style>
  .empty {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    width: auto;
    min-height: calc(100dvh - var(--consent-room, 0px));
    margin: 0;
    padding: 5rem 1rem 6rem;
    text-align: center;
  }
  .empty p {
    max-width: 22rem;
    margin: 0;
  }
</style>
