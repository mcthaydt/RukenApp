<!--
  Your account: who is signed in, where their membership stands, the one thing they can do about it, a quiet way
  to sign out and a plain link to delete the account.
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

<main class="card">
  <h1>Your account</h1>
  <p>{data.phone}</p>
  <p class="note"><a href="/me/password">Change password</a></p>
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
  {#if data.makesGames}
    <p class="apart"><a href="/make">Your games</a></p>
  {:else}
    <p class="apart">Make games? <a href="/make">Add yours to Ruken.</a></p>
  {/if}
  <p><a href="/about">What is Ruken?</a></p>
  <p class="note"><a href="/me/computers">Your computers</a></p>
  <!-- A full line of air above it, so a thumb meant for another link never lands on Delete. -->
  <p class="note apart"><a href="/me/delete">Delete my account</a></p>
</main>
