<!--
  Delete my account: what happens now, what happens in 14 days, and how to undo it. "Keep my account" is the way
  back. The button spends no money, so it is the card's one plain button, never the pip-red one.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Delete your account? · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Delete your account?</h1>
  {#if data.staff}
    <p>Staff accounts are removed by another staff member.</p>
  {:else}
    <p>We'll sign you out everywhere now, and delete your account in 14 days.</p>
    <p>Changed your mind? Sign in before then and nothing is deleted.</p>
    <form method="POST">
      <button>Delete my account</button>
    </form>
  {/if}
  <p><a href="/me">Keep my account</a></p>
</main>
