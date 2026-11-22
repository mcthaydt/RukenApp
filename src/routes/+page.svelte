<script lang="ts">
  import { Feed } from "../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<Feed clips={data.clips} launch={data.launch} />
