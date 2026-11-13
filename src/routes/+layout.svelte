<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it and the layout adds
  nothing else, so a screen is plain elements and the few classes the look names.
-->
<script lang="ts">
  import "$lib/look.css";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

{@render children()}
