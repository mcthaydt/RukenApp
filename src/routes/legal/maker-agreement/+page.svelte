<!--
  The maker agreement: the heading, its version, and the Owner's text as paragraphs. Nothing on it is a button.
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
</main>
