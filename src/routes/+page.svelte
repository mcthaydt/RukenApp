<!--
  A placeholder until the feed arrives in slice 3 (design 7.5). It exists so the app builds and the
  browser check has a page to open. Until then it gives a person one way on: to sign in, or, once she is signed in,
  to her games and her account, which are everything there is to press; staff also get their list of games to check.
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
  {#if data.signedIn}
    <p><a class="button" href="/make">Your games</a></p>
    {#if data.staff}
      <p><a class="quiet" href="/admin/games">Games to check</a></p>
    {/if}
    <p><a class="quiet" href="/me">Your account</a></p>
  {:else}
    <p><a class="button" href="/sign-in">Sign in</a></p>
  {/if}
</main>
