<!--
  The Good pick card (learned feed spec 6.1): a frosted card over a clip, naming a game the feed is asking about,
  "Good pick?", and two big buttons, Yes and No. Either answer is kept and the feed moves on; swiping past it counts for
  nothing.
-->
<script lang="ts">
  let {
    ask,
    onanswered,
  }: {
    /** The game asked about; left out, there is no card. */
    ask: { slug: string; name: string } | undefined;
    onanswered: () => void;
  } = $props();

  let busy = $state<"yes" | "no" | null>(null);
  let problem = $state("");

  async function answer(yes: boolean): Promise<void> {
    if (busy !== null || ask === undefined) return;
    busy = yes ? "yes" : "no";
    problem = "";
    try {
      const response = await fetch("/api/feed/good-pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: ask.slug, yes }),
      });
      // Already answered somewhere else is answered all the same: the card goes either way.
      if (!response.ok && response.status !== 409) {
        problem = "That didn't work. Try again.";
        return;
      }
      onanswered();
    } catch {
      problem = "That didn't work. Check your connection and try again.";
    } finally {
      busy = null;
    }
  }
</script>

{#if ask !== undefined}
  <div class="goodpick" role="group" aria-labelledby={`good-pick-${ask.slug}`}>
    <p class="name">{ask.name}</p>
    <h2 id={`good-pick-${ask.slug}`}>Good pick?</h2>
    <div class="answers">
      <button type="button" aria-busy={busy === "yes" ? "true" : undefined} onclick={() => void answer(true)}
        >Yes</button
      >
      <button type="button" aria-busy={busy === "no" ? "true" : undefined} onclick={() => void answer(false)}
        >No</button
      >
    </div>
    {#if problem !== ""}
      <p class="problem" role="alert">{problem}</p>
    {/if}
  </div>
{/if}

<style>
  .goodpick {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 3;
    translate: -50% -50%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(22rem, calc(100% - 2rem));
    padding: 1.25rem;
    border-radius: var(--radius-card);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
    text-align: center;
  }
  .name {
    margin: 0;
    color: var(--sage);
    overflow-wrap: anywhere;
  }
  h2 {
    margin: 0;
    font: var(--text-statement);
  }
  .answers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .answers button {
    margin: 0;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .problem {
    margin: 0;
  }
</style>
