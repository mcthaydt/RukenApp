<!--
  The maker agreement: the heading, its version (said once), the Owner's text as paragraphs, and the way back. Nothing
  on it is a button.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Maker agreement · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Maker agreement</h1>
  <p class="note">Version {data.version}</p>
  {#each data.paragraphs as paragraph, index (index)}
    <p>{paragraph}</p>
  {/each}
  <p><a href={data.back.href}>{data.back.words}</a></p>
</main>
