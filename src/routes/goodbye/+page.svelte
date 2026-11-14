<!--
  After asking to be deleted: signed out, the day it will happen, and how to undo it. No sign-in is needed to
  see it, because the person has just been signed out.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>You're signed out · Ruken</title>
</svelte:head>

<main class="card">
  <h1>You're signed out.</h1>
  {#if data.date !== null}
    <p>Your account will be deleted on {data.date}.</p>
    <p>Changed your mind? Sign in before then.</p>
  {/if}
  <p><a class="button" href="/">Back to Ruken</a></p>
</main>
