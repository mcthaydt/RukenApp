<!-- Playing (spec 4): the screen is the play feature's own (src/features/play/PlayScreen.svelte). -->
<script lang="ts">
  import { PlayScreen } from "../../../../features/play/play.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<PlayScreen
  name={data.name}
  makerName={data.makerName}
  frameUrl={data.frameUrl}
  frameRules={data.frame}
  beats={{ address: `/g/${data.slug}/play/beat`, session: data.session }}
  leave={{ href: `/g/${data.slug}`, note: "Back to the game's page." }}
  testPlay={false}
/>
