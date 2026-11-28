<script lang="ts">
  import { untrack } from "svelte";
  import { Followed, kept } from "../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // A new first page (coming back to the tab) starts it again from it; one from a quiet refresh (kept.svelte.ts) goes
  // into the tab on screen instead.
  // svelte-ignore state_referenced_locally
  let started = data;
  const shown = $derived.by(() => {
    const now = data;
    if (!untrack(() => kept.quiet)) started = now;
    return started;
  });
</script>

{#key shown}
  <Followed {...data} />
{/key}
