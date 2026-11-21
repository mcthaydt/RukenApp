<!--
  Change email: the new address and the current password, one blue button. Saving only sends a link to the new address;
  the account's address changes when the link is opened, so until then sign-in and mail use the old one. A member is
  told their receipts still go to the old address.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>Change your email · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Change your email</h1>
  {#if form?.sentTo}
    <p role="status">We sent a link to {form.sentTo}. Open it to finish.</p>
    <p>Until then, you sign in with {data.email}.</p>
    {#if data.member}
      <p>Your payment receipts still go to {data.email} for now.</p>
    {/if}
    <p><a class="button" href="/me">Back to your account</a></p>
  {:else}
    <p>Your email now: {data.email}</p>
    <form method="POST">
      <p>
        <label>
          New email
          <input type="email" name="email" autocomplete="email" />
        </label>
        {#if form?.field === "email"}
          <span class="problem" role="alert">{form.error}</span>
        {/if}
      </p>
      <p>
        <label>
          Your password
          <input type="password" name="password" autocomplete="current-password" />
        </label>
        {#if form?.field === "password"}
          <span class="problem" role="alert">{form.error}</span>
        {/if}
      </p>
      {#if data.member}
        <p class="note">Your payment receipts will still go to {data.email} for now.</p>
      {/if}
      {#if form?.field === "form"}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Send the link</button>
    </form>
    <p><a href="/me">Back to your account</a></p>
  {/if}
</main>
