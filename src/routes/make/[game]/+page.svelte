<!--
  A game that is past its questions: where it stands, in the maker's words, and the one next step. Waiting is final
  here; Sent back and Live say more (their own screens come with their own tasks).
-->
<script lang="ts">
  import StateScreen from "../parts/StateScreen.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<StateScreen name={data.name} headline={data.headline} nextStep={data.nextStep} />
