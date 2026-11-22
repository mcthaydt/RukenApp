<!--
  Forgot password, in two screens on one address. First: country and phone number. Then the code, which may come by
  text or, for a member, to the email they pay with, and the new password twice. The code screen reads the same
  whether or not the number has an account.
-->
<script lang="ts">
  import PhoneFields from "../../lib/phone-fields.svelte";
  import TextItAgain from "../../lib/text-it-again.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<main class="card">
  {#if form?.step === "code"}
    <h1>Choose a new password</h1>
    <p>
      If that number has a Ruken account, we sent a code. It may come by text, or to the email you pay with.
    </p>
    <form method="POST" action="?/finish">
      <input type="hidden" name="number" value={form.number} />
      <input type="hidden" name="country" value={form.country} />
      <input type="hidden" name="phone" value={form.phone} />
      <p>
        <label>
          The code we sent you
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" />
        </label>
      </p>
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
      {#if form.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Save my new password</button>
      <TextItAgain />
    </form>
  {:else}
    <h1>Forgot your password?</h1>
    <p>Enter your phone number and we'll text you a code to choose a new one.</p>
    <form method="POST" action="?/start">
      <PhoneFields countries={data.countries} country={form?.country} phone={form?.phone} />
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Text me a code</button>
    </form>
  {/if}
  <p><a class="quiet" href="/sign-in">Back to sign in</a></p>
</main>
