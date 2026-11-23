<!--
  Cookies. A browser with no yes sees the notice as the screen's one card, with what was pressed on top when a button
  that needs the yes sent it here. A browser with a yes sees when it said so and one button, "Take it back", which
  signs this browser out here and deletes everything Ruken keeps on it. The account stays.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { forgetThisDevice } from "../../features/consent/consent.browser.ts";
  import { Notice } from "../../features/consent/consent.screens.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let sending = $state(false);
</script>

{#if data.consented}
  <main class="card">
    <h1>Cookies</h1>
    {#if data.day !== null}
      <p>You said yes on this browser on {data.day}.</p>
    {:else}
      <p>You said yes on this browser.</p>
    {/if}
    <p>Ruken keeps a few small things in it so you stay signed in and can play.</p>
    <form
      method="POST"
      action="?/takeBack"
      use:enhance={() => {
        sending = true;
        return async ({ update }) => {
          forgetThisDevice();
          await update();
          sending = false;
        };
      }}
    >
      <button class="safe" disabled={sending} aria-busy={sending}>Take it back</button>
    </form>
    <p class="note">This signs you out here. Your account stays.</p>
    <p class="note"><a class="go" href="/privacy">What we keep</a></p>
  </main>
{:else}
  {#if form?.done}
    <p role="status" class="panel">Done. Ruken keeps nothing on this browser now.</p>
  {/if}
  <Notice reason={data.reason} next={data.next} from={data.from} onNotNow={() => undefined} />
{/if}
