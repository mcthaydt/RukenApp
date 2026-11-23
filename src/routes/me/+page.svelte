<!--
  Your account: who is signed in, where their membership stands, the one thing they can do about it, side links to
  the pages around it, then a quiet button to sign out and another to delete the account.
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
  <!-- Side links, one under another: each goes to a page of its own (the owner, 2026-11-23: secondary actions are the →
       links). -->
  <ul class="links apart">
    <li><a class="go" href="/make">{data.makesGames ? "Your games" : "Add your games to Ruken"}</a></li>
    <li><a class="go" href="/me/password">Change password</a></li>
    <li><a class="go" href="/me/computers">Your computers</a></li>
    <li><a class="go" href="/about">What is Ruken?</a></li>
  </ul>
  <form class="apart" method="POST" action="/sign-out">
    <button class="quiet">Sign out</button>
  </form>
  <!-- A full line of air above it, so a thumb meant for Sign out never lands on Delete. -->
  <p class="apart"><a class="quiet" href="/me/delete">Delete my account</a></p>
</main>
