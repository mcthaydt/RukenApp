<script lang="ts">
  import { MarkedGames } from "../../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<MarkedGames
  heading="Saved"
  empty="Nothing saved yet. Press Save on a game in the feed and it shows up here."
  games={data.games}
  removed={form?.removed === true}
/>
