<script lang="ts">
  import { YourFeed } from "../../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<YourFeed feed={data.feed} asked={data.asked} problem={form?.problem ?? null} />
