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
  <!-- The number with a badge beside it that says at a glance whether this is a member (the owner, 2026-11-23: "beside
       the number we can have a green or red badge"). "You're not a member." is then the badge alone; any other line
       (renews on, ends on, card failed) still says what it needs to. -->
  <p class="badged">
    <span>{data.phone}</span>
    {#if data.member}
      <span class="badge member">Member</span>
    {:else}
      <span class="badge">Not a member</span>
    {/if}
  </p>
  {#if data.membership.button !== "join"}
    <p>{data.membership.line}</p>
  {/if}
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
  <ul class="sidelinks apart">
    <!-- Only once there is something on them, so a new account keeps its one screen (the owner, 2026-11-24). -->
    {#if data.saved || data.reposted}
      <li class="pair">
        {#if data.saved}<a class="go" href="/me/saved">Saved</a>{/if}
        {#if data.reposted}<a class="go" href="/me/reposts">Your reposts</a>{/if}
      </li>
    {/if}
    <li><a class="go" href="/make">{data.makesGames ? "Your games" : "Add your games to Ruken"}</a></li>
    <li><a class="go" href="/me/password">Change password</a></li>
    <li><a class="go" href="/me/computers">Your computers</a></li>
    <li><a class="go" href="/about">What is Ruken?</a></li>
  </ul>
  <!-- Side by side, so the whole account fits on a phone with no scrolling (the owner, 2026-11-24); the row's gap keeps
       a thumb meant for Sign out off Delete. -->
  <div class="ways apart side-by-side">
    <form method="POST" action="/sign-out">
      <button class="quiet">Sign out</button>
    </form>
    <a class="quiet" href="/me/delete">Delete my account</a>
  </div>
</main>
