<!--
  "Pick your page's colours": the tiles are the pages feature's (ThemePicker), here in a question of their own.
-->
<script lang="ts">
  import ThemePicker from "../../../features/pages/ThemePicker.svelte";
  import QuestionScreen from "./QuestionScreen.svelte";

  let { themeId, problem }: { themeId: number; problem: string | undefined } = $props();
</script>

<QuestionScreen heading="Pick your page's colours" title="Your page · Ruken" counter={null} back="/make/page">
  <ThemePicker
    name="themeId"
    chosen={themeId}
    describedBy={problem === undefined ? "hint" : "hint problem"}
  />
  <p class="note" id="hint">You can change them any time.</p>
  {#if problem !== undefined}
    <p class="problem" id="problem" role="alert">{problem}</p>
  {/if}
</QuestionScreen>
