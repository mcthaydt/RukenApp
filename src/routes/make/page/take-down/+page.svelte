<!--
  Taking your page down. "Keep my page" is the safe choice, first and focused, so a stray Enter keeps the page. "Take
  my page down" is the red one, the only red thing here. Nothing here is blue and there is nothing to type.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let keep: HTMLAnchorElement | undefined = $state();
  // True from the press until the answer comes: a second press while the first is out would ask twice.
  let sending = $state(false);
  onMount(() => keep?.focus());
</script>

<main class="card">
  <h1>Take {data.name} down?</h1>
  <p>Nobody will be able to open /{data.handle} any more. Its links, photo and counts go too.</p>
  <p>Your games and your account stay. You can make a new page any time.</p>
  <p><a class="button safe" href="/make/page" bind:this={keep}>Keep my page</a></p>
  <form
    method="POST"
    action="?/takeDown"
    use:enhance={({ cancel }) => {
      if (sending) cancel();
      sending = true;
      return async ({ update }) => {
        await update();
        sending = false;
      };
    }}
  >
    <button class="danger" disabled={sending} aria-busy={sending ? "true" : undefined}>
      {sending ? "Taking it down…" : "Take my page down"}
    </button>
  </form>
</main>
