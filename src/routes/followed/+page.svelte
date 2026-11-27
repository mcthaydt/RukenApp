<script lang="ts">
  import { Followed } from "../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<!-- A new first page (coming back to the tab) starts it again from it. -->
{#key data}
  <Followed {...data} />
{/key}
