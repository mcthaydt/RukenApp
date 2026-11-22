<script lang="ts">
  import { MakerPage } from "../../features/pages/pages.screens.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<MakerPage {...data} />
