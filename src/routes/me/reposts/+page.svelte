<script lang="ts">
  import { MarkedGames } from "../../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<MarkedGames
  heading="Your reposts"
  empty="No reposts yet. Press Repost on a game in the feed and it shows up here."
  games={data.games}
  removed={form?.removed === true}
/>
