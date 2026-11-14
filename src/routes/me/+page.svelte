<!--
  Your account: who is signed in, where their membership stands, the one thing they can do about it, a quiet way
  to sign out and a plain link to delete the account. The "Confirm your email" line shows only while the address is
  unconfirmed.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // What each button under the membership line says (membership/format.ts picks which one).
  const BUTTON_WORDS = {
    manageOrCancel: "Change card or cancel",
    manage: "Manage",
    updateCard: "Update card",
  } as const;
</script>

<svelte:head>
  <title>Your account · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Your account</h1>
  <p>{data.email}</p>
  {#if !data.emailVerified}
    {#if form?.resent}
      <p role="status">Sent. Check your email.</p>
    {:else}
      <form method="POST" action="?/resend">
        <p>Confirm your email. We sent you a link.</p>
        {#if form?.error}
          <p class="problem" role="alert">{form.error}</p>
        {/if}
        <p><button class="quiet">Send it again</button></p>
      </form>
    {/if}
  {/if}
  <p>{data.membership.line}</p>
  {#if data.membership.button === "join"}
    <p><a class="button" href="/join?next=/me">Join Ruken</a></p>
  {:else}
    <form method="POST" action="?/portal">
      {#if form?.portalError}
        <p class="problem" role="alert">{form.portalError}</p>
      {/if}
      <button>{BUTTON_WORDS[data.membership.button]}</button>
      <small class="note">Opens our payment page, run by Stripe.</small>
    </form>
  {/if}
  <form method="POST" action="/sign-out">
    <button class="quiet">Sign out</button>
  </form>
  <p class="note apart"><a href="/me/delete">Delete my account</a></p>
</main>
