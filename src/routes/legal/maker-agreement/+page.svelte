<!--
  The maker agreement: the heading, its version and the date the file carries (said once), the Owner's text as a
  numbered list, and the way back at the top as well as the end, so it is never three screens away on a phone. Nothing
  on it is a button.
-->
<script lang="ts">
  import Points from "./Points.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Maker agreement · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Maker agreement</h1>
  <p class="note">
    Version {data.version}{#if data.updated !== null}
      · Last updated {data.updated}{/if}
  </p>
  <p>You agree to this once, when you send your first game.</p>
  <p><a href={data.back.href}>{data.back.words}</a></p>
  <Points points={data.points} />
  <p><a href={data.back.href}>{data.back.words}</a></p>
</main>
