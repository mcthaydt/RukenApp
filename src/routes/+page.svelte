<script lang="ts">
  import { untrack } from "svelte";
  import { Feed, kept } from "../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // A new first page (coming back to the feed) starts the feed again from it; one from a quiet refresh (kept.svelte.ts)
  // goes into the feed on screen instead.
  // svelte-ignore state_referenced_locally
  let started = data.first;
  const shown = $derived.by(() => {
    const first = data.first;
    if (!untrack(() => kept.quiet)) started = first;
    return started;
  });
</script>

{#key shown}
  <Feed
    first={data.first}
    launch={data.launch}
    tune={data.tune}
    news={data.news}
    friends={data.friends}
    playtest={data.playtest}
  />
{/key}
