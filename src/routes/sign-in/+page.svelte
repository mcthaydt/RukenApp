<!--
  Sign in with an email and a password. A plain HTML form, so it works before any script loads.
  Every way out of a failure is on the page: the refusal sits above the button and "Forgot your
  password?" is the next step.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  // `value` is left undefined on a first visit, not "": Svelte writes any value it is given onto the
  // input when it hydrates, which would wipe text typed before the script loaded.
  let { data, form }: PageProps = $props();

  let signUpLink = $derived(`/sign-up?next=${encodeURIComponent(data.next)}`);
</script>

<svelte:head>
  <title>Sign in · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Sign in</h1>
  {#if data.reset}
    <p role="status">Your password is updated. Sign in with it.</p>
  {/if}
  <form method="POST">
    <input type="hidden" name="next" value={data.next} />
    <p>
      <label>
        Email
        <input type="email" name="email" autocomplete="email" value={form?.email} />
      </label>
    </p>
    <p>
      <label>
        Password
        <input type="password" name="password" autocomplete="current-password" />
      </label>
    </p>
    {#if form?.error}
      <p class="problem" role="alert">{form.error}</p>
    {/if}
    <button>Sign in</button>
  </form>
  <p><a href="/forgot-password">Forgot your password?</a></p>
  <p>New here? <a href={signUpLink}>Create an account</a></p>
</main>
