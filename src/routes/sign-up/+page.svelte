<!--
  Sign up. A plain HTML form, so it works before any script loads. A refusal sits above the button,
  says what to fix, and keeps what was typed (not the password). Under 13, the form is replaced by
  a refusal with one way back.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  // `value` is left undefined on a first visit, not "": Svelte writes any value it is given onto the
  // input when it hydrates, which would wipe text typed before the script loaded.
  let { data, form }: PageProps = $props();

  let signInLink = $derived(`/sign-in?next=${encodeURIComponent(data.next)}`);
</script>

<svelte:head>
  <title>Create your account · Ruken</title>
</svelte:head>

<main class="card">
  {#if form?.tooYoung}
    <h1>Ruken isn't for you yet.</h1>
    <p>Come back when you're 13.</p>
    <p><a class="button" href="/">Back to Ruken</a></p>
  {:else}
    <h1>Create your account</h1>
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
          <input type="password" name="password" autocomplete="new-password" />
        </label>
        <small class="note">At least 10 characters.</small>
      </p>
      <fieldset>
        <legend>When were you born?</legend>
        <div class="row">
          <label>
            Month
            <input
              type="text"
              name="month"
              inputmode="numeric"
              autocomplete="bday-month"
              placeholder="MM"
              value={form?.month}
            />
          </label>
          <label>
            Day
            <input
              type="text"
              name="day"
              inputmode="numeric"
              autocomplete="bday-day"
              placeholder="DD"
              value={form?.day}
            />
          </label>
          <label>
            Year
            <input
              type="text"
              name="year"
              inputmode="numeric"
              autocomplete="bday-year"
              placeholder="YYYY"
              value={form?.year}
            />
          </label>
        </div>
        <p class="note">We only check that you're 13 or older. We don't keep your birthday.</p>
      </fieldset>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Create account</button>
    </form>
    <p>Already have an account? <a href={signInLink}>Sign in</a></p>
  {/if}
</main>
