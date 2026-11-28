<!--
  The name friends see: one field and one blue button. Asked once after sign-up, it makes the account's page; opened from
  Your account, it changes the name only. Someone who will not give a name can sign out or delete the account, so the
  screen is never a dead end.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<main class="card">
  <h1>What should friends call you?</h1>
  <p>
    {data.adult
      ? "Friends see this when you send them a game."
      : "Use a nickname, not your full name. Friends see it."}
  </p>
  <form method="POST">
    <p>
      <label>
        Your name
        <input name="name" autocomplete="nickname" value={form?.name ?? data.name} />
      </label>
      {#if form?.error}
        <span class="problem" role="alert">{form.error}</span>
      {/if}
    </p>
    {#if form?.saved}
      <p role="status">Saved.</p>
    {/if}
    <button>Save</button>
  </form>
  <ul class="sidelinks apart">
    {#if data.hasPage}
      <li><a class="go" href="/me">Back to your account</a></li>
    {:else}
      <li>
        <form method="POST" action="/sign-out">
          <button class="go">Sign out</button>
        </form>
      </li>
      <li><a class="go" href="/me/delete">Delete my account</a></li>
    {/if}
  </ul>
</main>
