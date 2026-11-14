<!--
  The page every failure lands on: an address nobody serves, or something that broke on our side.
  It says in one line what happened and gives one way back. It never shows the error's own text,
  which is for us and not for a person.
-->
<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>Ruken</title>
</svelte:head>

<main class="card">
  {#if page.status === 404}
    <h1>We can't find that page.</h1>
  {:else}
    <h1>Something went wrong on our side.</h1>
    <p>Try again in a moment.</p>
  {/if}
  <p><a class="button" href="/">Back to Ruken</a></p>
</main>
