<!--
  Sign up, in two screens on one address. First: country, phone number, password and date of birth. Then the code
  we texted. Plain HTML forms, so both work before any script loads. A refusal sits above the button, says what to
  fix, and keeps what was typed (not the password, not the code). Under 13, the form is replaced by a refusal with
  one way back. The code screen reads the same for every number, so it says nothing about who has an account.
-->
<script lang="ts">
  import PhoneFields from "../../lib/phone-fields.svelte";
  import type { PageProps } from "./$types";

  // `value` is left undefined on a first visit, not "": Svelte writes any value it is given onto the
  // input when it hydrates, which would wipe text typed before the script loaded.
  let { data, form }: PageProps = $props();

  let signInLink = $derived(`/sign-in?next=${encodeURIComponent(data.next)}`);
  let nextPath = $derived(form?.next ?? data.next);
</script>

<svelte:head>
  <title>Join Ruken</title>
</svelte:head>

<main class="card">
  {#if form?.tooYoung}
    <h1>Ruken isn't for you yet.</h1>
    <p>Come back when you're 13.</p>
    <p><a class="button" href="/">Back to Ruken</a></p>
  {:else if form?.step === "code"}
    <h1>We texted you a code</h1>
    <form method="POST" action="?/finish">
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="number" value={form.number} />
      <input type="hidden" name="country" value={form.country} />
      <input type="hidden" name="phone" value={form.phone} />
      <input type="hidden" name="month" value={form.month} />
      <input type="hidden" name="day" value={form.day} />
      <input type="hidden" name="year" value={form.year} />
      <p>
        <label>
          The code we texted you
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" />
        </label>
      </p>
      {#if form.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Join Ruken</button>
      <button class="quiet" formaction="?/again" formnovalidate>Text it again</button>
    </form>
    <p><a href={`/sign-up?next=${encodeURIComponent(nextPath)}`}>Change the number</a></p>
    <p class="note">
      No text? Check the number, or <a href={signInLink}>sign in</a> if you already have an account.
    </p>
  {:else}
    <h1>Join Ruken</h1>
    <form method="POST">
      <input type="hidden" name="next" value={data.next} />
      <PhoneFields countries={data.countries} country={form?.country} phone={form?.phone} />
      <p>
        <label>
          Password
          <input type="password" name="password" autocomplete="new-password" />
        </label>
        <small class="note">At least 10 characters.</small>
      </p>
      <fieldset>
        <legend>Date of birth</legend>
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
      <p class="note">
        We'll text you a code to check it's you, and texts about your account. Message and data rates may apply. Reply
        STOP to stop, HELP for help.
      </p>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Text me a code</button>
    </form>
    <p>Already have an account? <a href={signInLink}>Sign in</a></p>
  {/if}
</main>
