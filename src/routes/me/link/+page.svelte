<!--
  Let this computer use your Ruken? One screen, the code in big letters, one big Yes and a plain No. Above them, the
  facts a stranger cannot choose: where it was asked from, when, and what the computer calls itself. When the ask came
  from another place than this browser, a warning says so and No becomes the big button: Yes stays, since a maker on a
  VPN or a second network is real.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>Let this computer use your Ruken? · Ruken</title>
</svelte:head>

<main class="card">
  {#if form?.answered === "yes"}
    <h1>Done</h1>
    <p role="status">You can close this page and go back to your terminal.</p>
    <p class="note"><a class="go" href="/me/computers">See your computers</a></p>
  {:else if form?.answered === "no"}
    <h1>No problem</h1>
    <p role="status">That computer can't use your Ruken.</p>
    <p><a class="button" href="/me">Back to your account</a></p>
  {:else if data.stage === "ask"}
    <h1>Let this computer use your Ruken?</h1>
    <p class="code" aria-label="Your code">{data.code}</p>
    <p>
      {data.fromWords === "" ? "Asked from somewhere we can't tell" : `Asked from ${data.fromWords}`}, {data.ago}.
    </p>
    <p>It calls itself: {data.name}</p>
    {#if data.warning}
      <p class="problem" role="alert">{data.warning}</p>
    {/if}
    <p>Only press Yes if you just typed <code>npx ruken sign-in</code> yourself.</p>
    {#if form?.problem}
      <p class="problem" role="alert">{form.problem}</p>
      {#if form.tooMany}
        <p><a class="go" href="/me/computers">Your computers</a></p>
      {/if}
    {/if}
    {#if data.warning}
      <form method="POST" action="?/no">
        <input type="hidden" name="code" value={data.code} />
        <button>No</button>
      </form>
      <form method="POST" action="?/yes">
        <input type="hidden" name="code" value={data.code} />
        <button class="outline">Yes</button>
      </form>
    {:else}
      <form method="POST" action="?/yes">
        <input type="hidden" name="code" value={data.code} />
        <button>Yes</button>
      </form>
      <form method="POST" action="?/no">
        <input type="hidden" name="code" value={data.code} />
        <button class="quiet">No</button>
      </form>
    {/if}
  {:else}
    <h1>Let a computer use your Ruken?</h1>
    <p>Type <code>npx ruken sign-in</code> on your computer. It shows a code. Type that code here.</p>
    {#if data.problem}
      <p class="problem" role="alert">{data.problem}</p>
    {/if}
    <form method="GET">
      <p>
        <label>
          Your code
          <input name="code" autocomplete="off" autocapitalize="characters" value={data.typed ?? ""} />
        </label>
      </p>
      <button>Next</button>
    </form>
    <p class="note"><a class="quiet" href="/me">Back to your account</a></p>
  {/if}
</main>
