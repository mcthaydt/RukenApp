<!--
  After asking to be deleted: that the account will be deleted, the day, that they are signed out, and a link to undo
  it. No sign-in is needed to see it, because the person has just been signed out. With no readable day it only says
  they are signed out: it never says an account will be deleted when nothing says so.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.date !== null ? "Your account will be deleted" : "You're signed out"} · Ruken</title>
</svelte:head>

<main class="card">
  {#if data.date !== null}
    <h1>Your account will be deleted.</h1>
    <p>We'll delete it on {data.date}. You're signed out now.</p>
    <!-- Back to /me, so the welcome-back line and the account are the first things they see. -->
    <p>Changed your mind? <a href="/sign-in?next=%2Fme">Sign in</a> before then.</p>
  {:else}
    <h1>You're signed out.</h1>
  {/if}
  <p><a class="button" href="/">Back to Ruken</a></p>
</main>
