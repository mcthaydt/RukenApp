<script lang="ts">
  import { FeedTop, sawYourTurn } from "../../features/feed/feed.browser.ts";
  import { YourTurn } from "../../features/sends/sends.browser.ts";
  import type { PageProps } from "./$types";

  // The Your turn tab: the feed's top bar stays, so Fresh and Followed are one press or swipe away.
  let { data }: PageProps = $props();
  let seen = $state(false);
</script>

<FeedTop on="your-turn" news={data.signedIn && data.news && !seen} />

{#if data.signedIn}
  <YourTurn
    signedIn
    games={data.games}
    news={data.news}
    onseen={() => {
      seen = true;
      sawYourTurn();
    }}
  />
{:else}
  <YourTurn signedIn={false} />
{/if}
