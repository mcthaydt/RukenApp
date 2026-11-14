<!--
  Delete my account: what happens now, what happens in 14 days, and how to undo it. A paying member is told first that
  the membership ends now with no refund, and can cancel it without deleting. "Keep my account" is the way back. The
  button spends no money, so it is the card's one plain button, never the green one that spends.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
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
    {#if data.paying}
      <p>
        Your membership ends now. There is no refund for the time left, and signing in again does not bring it
        back.
      </p>
      <!-- Someone who only wants to stop paying gets the same Stripe page "Change card or cancel" opens on /me. It is
           a post, which a link cannot make, so it is a quiet button, which looks like a link. -->
      <form method="POST" action="/me?/portal">
        <button class="quiet">Only want to stop paying? Cancel your membership instead.</button>
      </form>
    {/if}
    <p>Changed your mind? Sign in before then and nothing is deleted.</p>
    <form method="POST">
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Delete my account</button>
    </form>
  {/if}
  <p><a href="/me">Keep my account</a></p>
</main>
