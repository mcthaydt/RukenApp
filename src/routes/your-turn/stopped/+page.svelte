<script lang="ts">
  import { Stopped } from "../../../features/sends/sends.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<Stopped people={data.people} />
