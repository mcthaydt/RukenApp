<!--
  Your account: who is signed in, and one button to sign out. The "Confirm your email" line shows
  only while the address is unconfirmed (membership and saved games arrive in later slices).
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>Your account · Ruken</title>
</svelte:head>

<main>
  <h1>Your account</h1>
  <p>{data.email}</p>
  {#if !data.emailVerified}
    {#if form?.resent}
      <p role="status">Sent. Check your email.</p>
    {:else}
      <form method="POST" action="?/resend">
        <p>Confirm your email. We sent a link to {data.email}.</p>
        {#if form?.error}
          <p role="alert">{form.error}</p>
        {/if}
        <button>Send it again</button>
      </form>
    {/if}
  {/if}
  <form method="POST" action="/sign-out">
    <button>Sign out</button>
  </form>
</main>
