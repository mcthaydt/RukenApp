<!--
  Settings › Your feed (learned feed spec 6.2): the Learn from what I do switch; a line built from the person's chips;
  what they want to see more of and less of, as chips with × to remove, suggestions with + to add, and Add for a sheet of
  moods, genres and makers; and Start over, which asks once. An under-18 sees only that their feed doesn't learn until
  a parent says yes. Every press is a form, so it works with no script; with script it stays on the page.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { enhance, type SubmitFunction } from "$app/forms";
  import Icon from "../../lib/icon.svelte";
  import type { Choice, YourFeed } from "./taste.ts";

  let { feed, problem }: { feed: YourFeed; problem: string | null } = $props();

  let addSheet = $state<HTMLDialogElement>();
  let addingTo = $state<"more" | "less">("more");
  let startOverSheet = $state<HTMLDialogElement>();
  // Which press is being sent: its button shows the spinner, and another press waits for it.
  let sending = $state<string | null>(null);
  let tastes = $state<HTMLDivElement>();

  // A chip just added is shown where it landed: the box slides to it, so closing Add always shows what changed.
  function showNewChip(before: ReadonlySet<string>): void {
    const added = [...feed.more, ...feed.less].find((chip) => !before.has(chip.id));
    if (added === undefined) return;
    tastes
      ?.querySelector(`[data-chip="${added.id}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function send(key: string): SubmitFunction {
    return ({ cancel }) => {
      if (sending !== null) {
        cancel();
        return;
      }
      sending = key;
      const before = new Set([...feed.more, ...feed.less].map((chip) => chip.id));
      return async ({ update }) => {
        await update({ reset: false });
        sending = null;
        addSheet?.close();
        startOverSheet?.close();
        await tick();
        showNewChip(before);
      };
    };
  }

  const busy = (key: string): "true" | undefined => (sending === key ? "true" : undefined);

  function openAdd(direction: "more" | "less"): void {
    addingTo = direction;
    addSheet?.showModal();
  }

  const groups = $derived([
    { title: "Moods", choices: feed.choices.moods },
    { title: "Kinds of game", choices: feed.choices.genres },
    { title: "Makers", choices: feed.choices.makers },
  ]);
</script>

{#snippet choiceForm(choice: Choice, direction: "more" | "less", suggestion: boolean)}
  {@const key = `add:${direction}:${choice.kind}:${choice.value}`}
  <form method="POST" action="?/add" use:enhance={send(key)}>
    <input type="hidden" name="direction" value={direction} />
    <input type="hidden" name="kind" value={choice.kind} />
    <input type="hidden" name="value" value={choice.value} />
    <button
      class={suggestion ? "suggestion" : "pick"}
      aria-busy={busy(key)}
      aria-label={suggestion ? `Add ${choice.words}` : undefined}
      >{suggestion ? `+ ${choice.words}` : choice.words}</button
    >
  </form>
{/snippet}

{#snippet chips(direction: "more" | "less")}
  {@const list = direction === "more" ? feed.more : feed.less}
  <ul class="chips">
    {#each list as chip (chip.id)}
      <li class="chip-on" data-chip={chip.id}>
        <span>{chip.words}</span>
        <form method="POST" action="?/remove" use:enhance={send(`remove:${chip.id}`)}>
          <input type="hidden" name="id" value={chip.id} />
          <button class="remove" aria-busy={busy(`remove:${chip.id}`)} aria-label={`Remove ${chip.words}`}
            ><Icon name="close" /></button
          >
        </form>
      </li>
    {/each}
    {#if direction === "more"}
      {#each feed.suggestions as choice (`${choice.kind}:${choice.value}`)}
        <li>{@render choiceForm(choice, "more", true)}</li>
      {/each}
    {/if}
    <!-- Add sits at the end of the chips, as the spec's sketch has it, so an empty side is one line, not two. -->
    <li>
      <button
        type="button"
        class="outline add"
        onclick={() => {
          openAdd(direction);
        }}>Add</button
      >
    </li>
  </ul>
{/snippet}

<main class="card yourfeed">
  <h1>Your feed</h1>
  {#if problem !== null}
    <p class="problem" role="alert">{problem}</p>
  {/if}

  {#if feed.learning === "locked"}
    <p>Your feed doesn't learn from what you do until a parent says yes.</p>
  {:else}
    <!-- It posts the state it wants, so a second press never undoes the first. -->
    <form class="learn" method="POST" action="?/learning" use:enhance={send("learning")}>
      <input type="hidden" name="learn" value={feed.learning === "on" ? "off" : "on"} />
      <button
        class="outline"
        role="switch"
        aria-busy={busy("learning")}
        aria-checked={feed.learning === "on"}
        data-on={feed.learning === "on" ? "" : undefined}
      >
        <span>Learn from what I do</span>
        <span class="state">{feed.learning === "on" ? "On" : "Off"}</span>
      </button>
    </form>

    {#if feed.learning === "off"}
      <p>Your feed isn't learning from what you do. Everyone sees the same feed as you.</p>
    {:else}
      <p class="sentence">{feed.sentence}</p>

      <!-- The chips' box: when they are more than the screen holds, it scrolls up and down by itself (by finger, wheel,
           keys or a gamepad's pad moving focus), and Back and Start over stay where they are below it. -->
      <div class="tastes" bind:this={tastes}>
        <section aria-labelledby="more-title">
          <h2 id="more-title">What you want to see more of</h2>
          {@render chips("more")}
        </section>

        <section aria-labelledby="less-title">
          <h2 id="less-title">What you want to see less of</h2>
          {@render chips("less")}
        </section>
      </div>
    {/if}
  {/if}
  <!-- Back is an arrow, as on the maker's screens, beside Start over: one line, always in view below the chips. -->
  <div class="foot">
    <a class="button safe back" href="/me" aria-label="Back to your account"><Icon name="back" /></a>
    {#if feed.learning === "on"}
      <button type="button" class="danger" onclick={() => startOverSheet?.showModal()}>Start over</button>
    {/if}
  </div>
</main>

<dialog
  class="sheet"
  bind:this={addSheet}
  aria-labelledby="add-title"
  onclick={(event) => {
    if (event.target === addSheet) addSheet.close();
  }}
>
  <div class="inside">
    <div class="top">
      <h2 id="add-title">{addingTo === "more" ? "See more of" : "See less of"}</h2>
      <button type="button" class="close" aria-label="Close" onclick={() => addSheet?.close()}
        ><Icon name="close" /></button
      >
    </div>
    {#each groups as group (group.title)}
      {#if group.choices.length > 0}
        <h3>{group.title}</h3>
        <ul class="picks">
          {#each group.choices as choice (`${choice.kind}:${choice.value}`)}
            <li>{@render choiceForm(choice, addingTo, false)}</li>
          {/each}
        </ul>
      {/if}
    {/each}
  </div>
</dialog>

<dialog
  class="sheet"
  bind:this={startOverSheet}
  aria-labelledby="start-over-title"
  onclick={(event) => {
    if (event.target === startOverSheet) startOverSheet.close();
  }}
>
  <div class="inside">
    <h2 id="start-over-title">Start over?</h2>
    <p>Your feed forgets what it learned about you.</p>
    <form method="POST" action="?/startOver" use:enhance={send("startOver")}>
      <button class="danger wide" aria-busy={busy("startOver")}>Start over</button>
    </form>
    <button type="button" class="quiet" onclick={() => startOverSheet?.close()}>Cancel</button>
  </div>
</dialog>

<style>
  .yourfeed section {
    margin-top: 1rem;
  }
  /* A side's name is a label over its chips, in the body's size: in the statement's it ran to two lines on a phone. */
  .yourfeed h2 {
    margin: 0 0 0.5rem;
    font: var(--text-body);
    font-weight: 600;
  }
  .sentence {
    margin-top: 0.75rem;
  }
  /* The switch: the words on the left and the state on the right, said in words as well as by its fill. */
  .learn button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    text-align: left;
  }
  .state {
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-small);
    background: var(--felt-raised);
    color: var(--chalk);
    font: var(--text-small);
    font-weight: 600;
  }
  .learn button[data-on] .state {
    background: var(--pay);
  }
  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Your feed is as tall as the view at most: its chips' box gives way, never the page, so the foot stays in sight. */
  :global(:root:has(main.yourfeed) body) {
    display: flex;
    flex-direction: column;
  }
  .yourfeed {
    display: flex;
    flex: 0 1 auto;
    flex-direction: column;
    min-height: 0;
  }
  .yourfeed > :not(.tastes) {
    flex: none;
  }
  .tastes {
    flex: 0 1 auto;
    min-height: 0;
    margin-inline: -0.25rem;
    padding: 0.25rem 0.25rem 0.75rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-padding-block: 0.25rem 0.75rem;
  }
  /* More below: the box's bottom edge fades out, so a cut-off line reads as "there is more". It sits on the box's
     own padding, so with nothing more it falls on no chip. */
  .tastes {
    -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 0.75rem), transparent);
    mask-image: linear-gradient(to bottom, #000 calc(100% - 0.75rem), transparent);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* A chip is not a line of a card's list: no space above it, so the row's gap is the only space. */
  .chips li,
  .picks li {
    display: flex;
    margin: 0;
  }
  .chips form,
  .picks form {
    display: flex;
    margin: 0;
  }
  /* A chip's button is the chip: not the full-width, spaced-out button a card's form usually ends with. */
  .chips form > button,
  .picks form > button,
  .learn > button {
    margin-top: 0;
  }
  .chips form > button,
  .picks form > button {
    width: auto;
  }
  /* A chip the feed learned or the person added: filled, with × to take it off. Gently rounded, not a pill. */
  .chip-on {
    align-items: center;
    gap: 0.25rem;
    min-height: var(--size-target);
    padding-left: 0.875rem;
    border-radius: var(--radius-small);
    background: var(--felt-raised);
    color: var(--chalk);
  }
  .remove {
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    margin: 0;
    padding: 0;
    background: none;
    color: inherit;
    box-shadow: none;
  }
  /* A suggestion, or a pick in Add: outlined, not filled, so it is not read as a chip already kept. A suggestion is
     on the paper card, in ink; a pick is on the glass sheet, in chalk. */
  .suggestion,
  .pick {
    min-height: var(--size-target);
    margin: 0;
    padding: 0 0.875rem;
    border: 2px solid var(--ink);
    border-radius: var(--radius-small);
    background: none;
    color: var(--ink);
    font: var(--text-body);
    box-shadow: none;
  }
  .pick {
    border-color: var(--chalk);
    color: var(--chalk);
  }
  .chips .add {
    width: auto;
    margin: 0;
    padding-inline: 1rem;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
  .foot > * {
    margin: 0;
  }
  /* A short window (an iPhone SE, a laptop): the air closes up, as on Your account, so the page fits above the bar
     with no scrolling. Every button keeps its whole 48px target. */
  @media (max-height: 820px) {
    .yourfeed {
      margin-top: 0.5rem;
      padding: 0.75rem;
    }
    .learn {
      margin-top: 0.75rem;
    }
    .sentence {
      margin-top: 0.5rem;
    }
    .yourfeed section {
      margin-top: 0.75rem;
    }
    .yourfeed h2 {
      margin-bottom: 0.25rem;
    }
    .foot {
      margin-top: 0.75rem;
      gap: 0.5rem;
    }
  }
  .sheet {
    width: min(28rem, calc(100vw - 2rem));
    max-width: none;
    max-height: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--radius-card);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
  }
  .sheet::backdrop {
    background: var(--dim-bg);
    -webkit-backdrop-filter: var(--dim-filter);
    backdrop-filter: var(--dim-filter);
  }
  .inside {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .inside p,
  .inside h2,
  .inside form {
    margin: 0;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .top h2 {
    margin: 0;
  }
  h3 {
    margin: 0.5rem 0 0;
    font: var(--text-body);
    font-weight: 600;
  }
  .close {
    flex: none;
    width: var(--size-target);
    margin: 0;
    padding: 0;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .wide {
    width: 100%;
  }
  .inside .quiet {
    align-self: center;
  }
</style>
