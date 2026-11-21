<script lang="ts">
  import MakerPage from "../../features/pages/MakerPage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<MakerPage {...data} />
