<script lang="ts">
  import { Feed } from "../features/feed/feed.browser.ts";
  import { ReportSheet, type ReportSheetControl } from "../features/moderation/moderation.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // One Report sheet for the whole feed; each clip's Report opens it for that game.
  let sheet = $state<ReportSheetControl>();
</script>

<!-- A new first page (coming back to the feed) starts the feed again from it. -->
{#key data.first}
  <Feed
    first={data.first}
    launch={data.launch}
    onreport={(clip: { slug: string; name: string }, from: HTMLElement) => {
      sheet?.open({ slug: clip.slug, name: clip.name }, from);
    }}
  />
{/key}
<ReportSheet bind:this={sheet} />
