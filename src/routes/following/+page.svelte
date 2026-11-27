<script lang="ts">
  import { Following } from "../../features/feed/feed.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<Following signedIn={data.signedIn} />
