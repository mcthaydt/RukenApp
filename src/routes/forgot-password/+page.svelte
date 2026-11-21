<!--
  Forgot password. After "Send the link" the page says the same thing whether or not the address has
  an account.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<svelte:head>
  <title>Forgot your password? · Ruken</title>
</svelte:head>

<main class="card">
  {#if form?.sent}
    <h1>Check your email</h1>
    <p role="status">If {form.email} has an account, we sent a link. It works once, for an hour.</p>
  {:else}
    <h1>Forgot your password?</h1>
    <p>Enter your email and we'll send a link to choose a new one.</p>
    <form method="POST">
      <p>
        <label>
          Email
          <input type="email" name="email" autocomplete="email" value={form?.email} />
        </label>
      </p>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Send the link</button>
    </form>
  {/if}
  <p><a href="/sign-in">Back to sign in</a></p>
</main>
