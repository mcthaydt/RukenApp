<!--
  A maker's test play of their own game before staff say yes. It is the play screen with the maker's area's bar left off
  (the game fills the window), labelled as a test play, and Leave goes back to the maker's game.
-->
<script lang="ts">
  import { PlayScreen } from "../../../../features/play/play.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<PlayScreen
  name={data.name}
  makerName={null}
  frameUrl={data.frameUrl}
  frameRules={data.frame}
  beats={null}
  leave={{ href: `/make/${data.slug}`, note: "Back to your game." }}
  testPlay={true}
/>
