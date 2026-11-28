<!--
  A parent's page: what the teen asked for and two big buttons, Yes and No. After Yes it says so and offers Turn it off;
  after No, or once the ask has ended, it says so and offers nothing. Every press is a plain form.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  // Which press is being sent: its button shows the spinner, and the other waits.
  let sending = $state<string | null>(null);

  const send = (key: string) => () => {
    sending = key;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      sending = null;
    };
  };
</script>

<main class="card">
  <h1>Your teen's feed</h1>
  {#if data.page.kind === "open"}
    <p>Your teen asked for a Ruken feed that learns what they like.</p>
    <p class="note">
      Ruken is where people find and play games. Yes lets their feed learn from what they play and watch.
    </p>
    <div class="row">
      <form method="POST" action="?/yes" use:enhance={send("yes")}>
        <button disabled={sending !== null} aria-busy={sending === "yes"}>Yes</button>
      </form>
      <form method="POST" action="?/no" use:enhance={send("no")}>
        <button class="safe" disabled={sending !== null} aria-busy={sending === "no"}>No</button>
      </form>
    </div>
  {:else if data.page.kind === "yes"}
    {#if data.page.held}
      <p role="status">You said yes. Their feed learns what they like.</p>
    {:else}
      <p role="status">Thanks. We'll turn it on when we can.</p>
    {/if}
    <p class="note">You can turn it off here any time.</p>
    <form method="POST" action="?/off" use:enhance={send("off")}>
      <button class="danger" disabled={sending !== null} aria-busy={sending === "off"}>Turn it off</button>
    </form>
  {:else if data.page.kind === "no"}
    <p role="status">You said no. Their feed stays the same as everyone's.</p>
  {:else if data.page.kind === "off"}
    <p role="status">It's off. Their feed doesn't learn from what they do.</p>
  {:else}
    <p role="status">This ask has ended.</p>
    <p class="note">Your teen can send a new one from Ruken.</p>
  {/if}
</main>
