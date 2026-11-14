<!--
  The agreement's points as a numbered list: the number hangs in the margin in the display face, the short title is
  bold, and the point itself sits under it, so every title and every point starts on one line. Each point keeps the
  number the Owner's file gives it. Used by the agreement page and by the fold-out on a game's page.
-->
<script lang="ts">
  let { points }: { points: { number: number; title: string; body: string }[] } = $props();
</script>

<ol>
  {#each points as point (point.number)}
    <li value={point.number}>
      <strong>{point.title}</strong>
      <p>{point.body}</p>
    </li>
  {/each}
</ol>
