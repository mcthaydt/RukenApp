<!--
  Change password: the current one and a new one, one blue button. Every other device that was signed in is signed
  out, and the screen says so.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>Change your password · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Change your password</h1>
  {#if !data.hasNumber}
    <p role="alert">
      Your account needs its phone number first. Ruken will add it, then you can change your password.
    </p>
    <p><a class="button" href="/me">Back to your account</a></p>
  {:else if form?.done}
    <p role="status">Done. Your password is changed.</p>
    <p>Anyone else signed in to your account was signed out.</p>
    <p><a class="button" href="/me">Back to your account</a></p>
  {:else}
    <form method="POST">
      <p>
        <label>
          Your password now
          <input type="password" name="password" autocomplete="current-password" />
        </label>
        {#if form?.field === "password"}
          <span class="problem" role="alert">{form.error}</span>
        {/if}
      </p>
      <p>
        <label>
          New password
          <input type="password" name="newPassword" autocomplete="new-password" />
        </label>
        <small class="note">At least 10 characters.</small>
        {#if form?.field === "newPassword"}
          <span class="problem" role="alert">{form.error}</span>
        {/if}
      </p>
      {#if form?.field === "form"}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Save password</button>
    </form>
    <p><a href="/me">Back to your account</a></p>
  {/if}
</main>
