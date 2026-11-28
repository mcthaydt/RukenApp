<!-- The maker's Playtesters page: the game's own video behind it, as on Live, and the page itself in front. -->
<script lang="ts">
  import { PlaytestersScreen } from "../../../../features/playtest/playtest.browser.ts";
  import GameBackdrop from "../../parts/GameBackdrop.svelte";
  import { watchUpright } from "../../parts/upright.svelte.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  const screen = watchUpright();
</script>

<GameBackdrop backdrop={data.backdrop} upright={screen.upright} />
<PlaytestersScreen {data} {form} />
