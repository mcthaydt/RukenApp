<!--
  Choose a new password. A link that is expired, used or made up shows one way on: a new link. A
  refused password keeps the link's token in the form, so one typing mistake does not use it up.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let linkInvalid = $derived(data.linkFailed || form?.linkInvalid === true);
  let token = $derived(form?.token ?? data.token);
</script>

<svelte:head>
  <title>Choose a new password · Ruken</title>
</svelte:head>

<main class="card">
  {#if linkInvalid}
    <h1>Choose a new password</h1>
    <p class="problem" role="alert">That link has expired or was already used.</p>
    <p><a class="button" href="/forgot-password">Send a new link</a></p>
  {:else}
    <h1>Choose a new password</h1>
    <form method="POST">
      <input type="hidden" name="token" value={token} />
      <p>
        <label>
          New password
          <input type="password" name="password" autocomplete="new-password" />
        </label>
        <small class="note">At least 10 characters.</small>
      </p>
      <p>
        <label>
          Type it again
          <input type="password" name="confirm" autocomplete="new-password" />
        </label>
      </p>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Save password</button>
    </form>
    <p><a href="/sign-in">Back to sign in</a></p>
  {/if}
</main>
