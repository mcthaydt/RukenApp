<script lang="ts">
  import { Search } from "../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<Search query={data.query} found={data.found} longest={data.longest} />
