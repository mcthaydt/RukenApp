<script lang="ts">
  import { Followed } from "../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<Followed signedIn={data.signedIn} />
