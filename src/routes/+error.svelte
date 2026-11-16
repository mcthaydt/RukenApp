<!--
  The page every failure lands on: an address nobody serves, or something that broke on our side.
  It says in one line what happened and gives one way back: to the maker's own games when the failure was inside the
  maker's area, to the list of games to check when it was inside the staff's area and the person is staff, and to Ruken's
  front page everywhere else. Someone who is not staff is never pointed at the staff's area: for them it is an address the
  site does not have. It never shows the error's own text, which is for us and not for a person.
-->
<script lang="ts">
  import { page } from "$app/state";

  const inMakersArea = $derived(page.url.pathname === "/make" || page.url.pathname.startsWith("/make/"));
  const inStaffArea = $derived(
    (page.url.pathname === "/admin" || page.url.pathname.startsWith("/admin/")) && page.data.staff === true,
  );
</script>

<svelte:head>
  <title>Ruken</title>
</svelte:head>

<main class="card">
  {#if page.status === 404}
    <h1>We can't find that page.</h1>
  {:else if page.status === 429}
    <h1>You've opened a lot of games just now.</h1>
    <p>Try again in a minute.</p>
  {:else}
    <h1>Something went wrong on our side.</h1>
    <p>Try again in a moment.</p>
  {/if}
  {#if inMakersArea}
    <p><a class="button" href="/make">Back to your games</a></p>
  {:else if inStaffArea}
    <p><a class="button" href="/admin/games">Back to games to check</a></p>
  {:else}
    <p><a class="button" href="/">Back to Ruken</a></p>
  {/if}
</main>
