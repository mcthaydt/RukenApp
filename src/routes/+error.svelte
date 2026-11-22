<!--
  The page every failure lands on: an address nobody serves, or something that broke on our side.
  It says in one line what happened and gives one way back: to the maker's own games when the failure was inside the
  maker's area, and to Ruken's front page everywhere else. It never shows the error's own text, which is for us and
  not for a person.
-->
<script lang="ts">
  import { page } from "$app/state";

  const inMakersArea = $derived(page.url.pathname === "/make" || page.url.pathname.startsWith("/make/"));
  // An 18+ game refused: the route throws one of two codes (accounts/adults.ts), never words for a person.
  const adultsOnly = $derived(page.status === 403 && page.error?.message.startsWith("adults-only:") === true);
  const signedOut = $derived(page.error?.message === "adults-only:signed-out");
  // Signing in comes back here: the game's page or its play screen. /sign-in checks `next` with safeNextPath.
  const signInHref = $derived(`/sign-in?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
</script>

<svelte:head>
  <title>Ruken</title>
</svelte:head>

<main class="card">
  {#if adultsOnly}
    <h1>This game is only for adults.</h1>
    {#if signedOut}
      <p>Sign in to play it.</p>
    {:else}
      <p>You need to be 18 or older to play it.</p>
    {/if}
  {:else if page.status === 404}
    <h1>We can't find that page.</h1>
  {:else if page.status === 429}
    <h1>You've opened a lot of games just now.</h1>
    <p>Try again in a minute.</p>
  {:else}
    <h1>Something went wrong on our side.</h1>
    <p>Try again in a moment.</p>
  {/if}
  {#if adultsOnly && signedOut}
    <p><a class="button" href={signInHref}>Sign in</a></p>
  {:else if inMakersArea}
    <p><a class="button" href="/make">Back to your games</a></p>
  {:else}
    <p><a class="button" href="/">Back to Ruken</a></p>
  {/if}
</main>
