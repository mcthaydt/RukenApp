<!--
  A placeholder until the feed arrives in slice 3 (design 7.5). It exists so the app builds and the
  browser check has a page to open. Until then it gives a person who is not signed in one way on.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Ruken</title>
</svelte:head>

<main>
  <h1>Ruken</h1>
  <p class="statement">Games, one swipe at a time. Coming soon.</p>
  {#if !data.signedIn}
    <p><a class="button" href="/sign-in">Sign in</a></p>
  {/if}
</main>
