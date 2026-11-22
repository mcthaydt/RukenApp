<script lang="ts">
  import { Feed } from "../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<!-- A new first page (coming back to the feed) starts the feed again from it. -->
{#key data.first}
  <Feed first={data.first} />
{/key}
