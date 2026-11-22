<!--
  The maker agreement, shown whole between a game's last question and Check and send: "Almost done" over the heading, its
  version and date, all seven points on one sheet, and one blue button. Pressing it is the agreeing, so there is no tick
  box, no fold-out and no link out. The heading is beside the sheet on a wide window and over it on a narrow one, and the
  buttons are after the last point, so agreeing comes after reading. On a wide window the sheet scrolls inside itself when
  the window is short, so the buttons under it stay in view. The page works before
  its script wakes; with script, a press says it is saving and cannot be pressed twice. There is no "press Enter" hint:
  agreeing to a contract is a press on the button and nothing else.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import Points from "../../../legal/maker-agreement/Points.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // One string, because a space written beside a block in the markup is dropped where the block starts.
  const versionWords = $derived(
    data.updated === null
      ? `Version ${data.version}`
      : `Version ${data.version} · Last updated ${data.updated}`,
  );

  // True from the press until the answer comes: a second press while the first is out would record twice.
  let saving = $state(false);
</script>

<main class="halves">
  <div>
    <p class="count">Almost done</p>
    <h1>Maker agreement</h1>
    <p class="note">{versionWords}</p>
    <!-- A way back is up here too on a wide window; a narrow window has Back in its bar. -->
    <a class="foot" href={data.back} data-wide>Back to the last question</a>
  </div>
  <!-- The buttons are after the last point, so the agreeing comes after the reading: on a wide window the points are on the right
       and the buttons are under them, in view, with the sheet scrolling inside itself. -->
  <form
    class="agreement"
    method="POST"
    use:enhance={({ cancel }) => {
      if (saving) cancel();
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}
  >
    <!-- Focusable so the keyboard can scroll it when it scrolls inside itself. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="sheet" role="region" aria-label="The maker agreement" tabindex="0">
      <Points points={data.points} />
    </div>
    <div class="acts">
      <a class="button safe" href={data.back}>Back</a>
      <button disabled={saving} aria-busy={saving ? "true" : undefined}>
        {saving ? "Saving…" : "I agree"}
      </button>
    </div>
  </form>
</main>
