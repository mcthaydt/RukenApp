<!--
  The maker agreement, shown whole between a game's last question and Check and send: "Almost done" over the heading, its
  version and date, all seven points on one sheet, and one blue button. Pressing it is the agreeing, so there is no tick
  box, no fold-out and no link out. Beside the sheet on a wide window, under it on a narrow one. The page works before
  its script wakes; with script, a press says it is saving and cannot be pressed twice.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import Points from "../../../legal/maker-agreement/Points.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // True from the press until the answer comes: a second press while the first is out would record twice.
  let saving = $state(false);
</script>

<svelte:head>
  <title>The maker agreement · Ruken</title>
</svelte:head>

<main class="halves">
  <form
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
    <p class="count">Almost done</p>
    <h1>The maker agreement</h1>
    <p class="note">
      Version {data.version}{#if data.updated !== null}
        · Last updated {data.updated}{/if}
    </p>
    <div class="acts">
      <a class="button safe" href={data.back}>Back</a>
      <button disabled={saving} aria-busy={saving ? "true" : undefined}>
        {saving ? "Saving…" : "I agree"}
      </button>
      <span class="key">press Enter <kbd>↵</kbd></span>
    </div>
  </form>
  <div class="sheet">
    <Points points={data.points} />
  </div>
</main>
