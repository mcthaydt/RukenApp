<!--
  The maker's Playtesters page (playtesting spec); its route draws the game's own video behind it, as Live has. On the left: the title, the
  switch that lets players ask, and Invite, which opens the invite sheet (the game's link to copy, a new link, and the
  maker's friends to press). On the right: who is asking, with Let play and ✕, and who is playing, with ✕, which asks
  once on a card first. Every form is a plain form, so the page works with no script; with script each press is sent in
  the background and the page reads itself again.
-->
<script lang="ts">
  import { browser } from "$app/env";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page as here } from "$app/state";
  import { onMount, tick, untrack } from "svelte";
  import Icon from "../../lib/icon.svelte";
  import { loads } from "../../lib/loads.ts";
  import { slideAway, slideAwayOnCancel } from "../../lib/sheet.ts";
  import type { Friend } from "../sends/sends.browser.ts";
  import type { PlaytestersPage, PlaytestPerson } from "./types.ts";
  import { dayWords, PLAYTEST_WORDS as W } from "./words.ts";

  interface Props {
    data: {
      page: PlaytestersPage;
      /** The invite sheet, when the page's address asks for it (?invite): the link, and the maker's friends. */
      invite: { link: string; faces: (Friend & { invited: boolean })[] } | null;
    };
    /** The last action's answer: a friend just invited, or a refusal to show. */
    form: { invited?: string; problem?: string } | null | undefined;
  }

  let { data, form }: Props = $props();
  // Until the script runs, the invite sheet is drawn open in the page itself (a dialog with no script cannot be modal).
  let enhanced = $state(false);
  // Set once, as the page is first drawn, and never again: Svelte sets a dialog's `open` as a property, and setting it
  // after the script has made the sheet modal hides it with no close.
  const drawnOpen = untrack(() => (!browser && data.invite !== null ? { open: true } : {}));
  onMount(() => {
    enhanced = true;
  });
  const game = $derived(data.page.game);
  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";
  const nameOf = (person: PlaytestPerson): string => person.name ?? W.someone;

  type Submit = NonNullable<Parameters<typeof enhance>[1]>;
  // One press at a time: a second press while the first is out would send twice. `sending` names the button whose press
  // is out, so only it turns busy.
  let sending = $state<string | null>(null);
  const once =
    (key: string): Submit =>
    ({ cancel }) => {
      if (sending !== null) {
        cancel();
        return;
      }
      sending = key;
      return async ({ update }) => {
        await update({ reset: false });
        sending = null;
      };
    };
  const busy = (key: string): "true" | undefined => (sending === key ? "true" : undefined);

  // The invite sheet is the page's ?invite: the server makes the link the first time it is opened.
  let sheet = $state<HTMLDialogElement>();
  let copyButton = $state<HTMLButtonElement>();
  let inviteButton = $state<HTMLAnchorElement>();
  let copied = $state("");
  const invitedName = $derived(
    form?.invited === undefined
      ? undefined
      : data.invite?.faces.find((face) => face.handle === form.invited)?.name,
  );

  $effect(() => {
    if (!enhanced || data.invite === null || sheet === undefined || sheet.matches(":modal")) return;
    copied = "";
    // Opened by a whole page load, the sheet was drawn open for a browser without script; it is made modal here.
    const opening = sheet;
    void tick().then(() => {
      if (opening.matches(":modal")) return;
      opening.removeAttribute("open");
      opening.showModal();
      copyButton?.focus();
    });
  });

  async function closed(): Promise<void> {
    await goto(here.url.pathname, { replace: true, reset: false });
    inviteButton?.focus();
  }

  async function copy(): Promise<void> {
    if (data.invite === null) return;
    try {
      await navigator.clipboard.writeText(data.invite.link);
      copied = W.copied;
    } catch {
      copied = matchMedia("(pointer: coarse)").matches
        ? "Press and hold the link above to copy it."
        : "Select the link above to copy it.";
    }
  }

  // Stop asks once, on a card.
  let stopCard = $state<HTMLDialogElement>();
  let stopping = $state<PlaytestPerson | null>(null);
  let stopOpener: HTMLElement | null = null;
  function askStop(event: SubmitEvent & { currentTarget: HTMLFormElement }, person: PlaytestPerson): void {
    event.preventDefault();
    stopping = person;
    stopOpener = event.submitter instanceof HTMLElement ? event.submitter : null;
    stopCard?.showModal();
  }
</script>

<main class="halves live playtesters">
  <div>
    <h1>{W.title}</h1>
    <p>{W.lede(game.name)}</p>
    <form class="countswitch" method="POST" action="?/asking" use:enhance={once("asking")}>
      <input type="hidden" name="asking" value={data.page.asking ? "off" : "on"} />
      <button class="outline" data-on={data.page.asking ? "" : undefined} aria-busy={busy("asking")}>
        {W.switch}
        <span class="chip">{data.page.asking ? W.on : W.off}</span>
      </button>
      <p class="note">{data.page.asking ? W.onNote(game.name) : W.offNote}</p>
    </form>
    <div class="acts">
      <a
        class="button"
        href="?invite"
        bind:this={inviteButton}
        data-sveltekit-replacestate
        data-sveltekit-noscroll>{W.invite}</a
      >
    </div>
    {#if form?.problem !== undefined}
      <p class="problem" role="alert">{form.problem}</p>
    {/if}
    <a class="foot" href={`/make/${game.slug}`}>{W.back(game.name)}</a>
  </div>

  <div class="people">
    {#if data.page.waiting.length === 0 && data.page.playing.length === 0}
      <p class="nobody">{W.empty}</p>
    {/if}
    {#if data.page.waiting.length > 0}
      <section aria-labelledby="asking-title">
        <h2 id="asking-title">{W.asking}</h2>
        <ul>
          {#each data.page.waiting as person (person.id)}
            <li>
              {@render face(person)}
              <span class="words">
                <strong>{W.wants(nameOf(person))}</strong>
                <span class="when">{dayWords(new Date(person.at))}</span>
              </span>
              <form method="POST" action="?/answer" use:enhance={once(`yes ${person.id}`)}>
                <input type="hidden" name="row" value={person.id} />
                <input type="hidden" name="yes" value="yes" />
                <button class="safe letplay" aria-busy={busy(`yes ${person.id}`)}
                  >{W.letPlay(nameOf(person))}</button
                >
              </form>
              <form method="POST" action="?/answer" use:enhance={once(`no ${person.id}`)}>
                <input type="hidden" name="row" value={person.id} />
                <input type="hidden" name="yes" value="no" />
                <button
                  class="quiet cross"
                  aria-busy={busy(`no ${person.id}`)}
                  aria-label={W.sayNo(nameOf(person))}><Icon name="close" /></button
                >
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if data.page.playing.length > 0}
      <section aria-labelledby="playing-title">
        <h2 id="playing-title">{W.playing}</h2>
        <ul>
          {#each data.page.playing as person (person.id)}
            {@const day = dayWords(new Date(person.at))}
            <li>
              {@render face(person)}
              <span class="words">
                <strong>{nameOf(person)}</strong>
                <span class="when">{person.invited ? W.invitedOn(day) : W.since(day)}</span>
              </span>
              <!-- With script the press asks first, on the card below; with none it stops them at once. -->
              <form
                method="POST"
                action="?/remove"
                onsubmit={(event) => {
                  askStop(event, person);
                }}
              >
                <input type="hidden" name="row" value={person.id} />
                <button class="quiet cross" aria-label={W.stop(nameOf(person))}><Icon name="close" /></button>
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</main>

{#snippet face(person: PlaytestPerson)}
  <span class="round" aria-hidden="true">
    {#if person.photo !== null}
      <img use:loads src={person.photo} alt="" width="48" height="48" loading="lazy" />
    {:else}
      <span>{initialOf(nameOf(person))}</span>
    {/if}
  </span>
{/snippet}

<dialog
  class="sharesheet rises invitesheet"
  tabindex="-1"
  bind:this={sheet}
  {...drawnOpen}
  aria-labelledby="invite-title"
  onclick={(event) => {
    if (event.target === sheet) slideAway(sheet);
  }}
  oncancel={slideAwayOnCancel}
  onclose={() => void closed()}
>
  {#if data.invite !== null}
    <div class="inside">
      <div class="top">
        <h2 id="invite-title">{W.sheetTitle}</h2>
        <a
          class="button close"
          href={here.url.pathname}
          aria-label="Close"
          data-sveltekit-replacestate
          data-sveltekit-noscroll
          onclick={(event) => {
            if (sheet === undefined) return;
            event.preventDefault();
            slideAway(sheet);
          }}><Icon name="close" /></a
        >
      </div>
      <p class="which">{game.name}</p>
      <p class="link">{data.invite.link}</p>
      <button type="button" class="main" bind:this={copyButton} onclick={() => void copy()}>{W.copy}</button>
      <form method="POST" action="?/newLink" use:enhance={once("newLink")}>
        <button class="go" aria-busy={busy("newLink")}>{W.newLink}</button>
      </form>
      <p class="said" role="status">{invitedName !== undefined ? W.invited(invitedName) : copied}</p>
      {#if data.invite.faces.length === 0}
        <p>{W.noFriends}</p>
      {:else}
        <ul class="faces">
          {#each data.invite.faces as friend (friend.handle)}
            <li>
              <!-- The page comes back at the action's own address, so it keeps ?invite and the sheet stays open. -->
              <form
                method="POST"
                action="?invite&/invite"
                use:enhance={(input) => {
                  // A friend already ticked is already playing: pressing again does nothing more.
                  if (friend.invited) {
                    input.cancel();
                    return;
                  }
                  return once(`invite ${friend.handle}`)(input);
                }}
              >
                <input type="hidden" name="handle" value={friend.handle} />
                <button
                  class="face"
                  class:on={friend.invited}
                  aria-pressed={friend.invited}
                  aria-busy={busy(`invite ${friend.handle}`)}
                  aria-label={W.inviteLabel(friend.name)}
                >
                  <span class="round" aria-hidden="true">
                    {#if friend.photo !== null}
                      <img use:loads src={friend.photo} alt="" width="48" height="48" loading="lazy" />
                    {:else}
                      <span>{initialOf(friend.name)}</span>
                    {/if}
                    {#if friend.invited}
                      <span class="tick">
                        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false"
                          ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
                        >
                      </span>
                    {/if}
                  </span>
                  <span class="name" aria-hidden="true">{friend.name}</span>
                </button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</dialog>

<dialog
  class="stopcard"
  bind:this={stopCard}
  aria-labelledby="stop-title"
  onclose={() => {
    stopOpener?.focus();
  }}
>
  {#if stopping !== null}
    <h2 id="stop-title">{W.stopAsk(nameOf(stopping))}</h2>
    <form
      method="POST"
      action="?/remove"
      use:enhance={(input) => {
        const after = once("stop")(input);
        return async (result) => {
          if (typeof after === "function") await after(result);
          stopCard?.close();
        };
      }}
    >
      <input type="hidden" name="row" value={stopping.id} />
      <button class="danger" aria-busy={busy("stop")}>{W.stopYes}</button>
    </form>
    <button type="button" class="quiet" onclick={() => stopCard?.close()}>{W.stopNo}</button>
  {/if}
</dialog>

<style>
  .people {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .people h2 {
    margin: 0 0 0.75rem;
    font: var(--text-statement);
  }
  .nobody {
    margin: 0;
  }
  .people ul,
  .faces {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .people ul {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .people li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .people form {
    margin: 0;
  }
  .words {
    display: flex;
    flex: 1 1 8rem;
    flex-direction: column;
    min-width: 0;
  }
  .when {
    font: var(--text-small);
  }
  .round {
    position: relative;
    flex: none;
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    border-radius: 50%;
    --corner: round;
    background: var(--felt-raised);
    color: var(--chalk);
    font-weight: 600;
  }
  .round img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    --corner: round;
    object-fit: cover;
  }
  .letplay {
    padding-inline: 1rem;
  }
  .cross {
    width: var(--size-target);
    padding: 0;
  }

  /* The invite sheet: the share sheet's own look (src/features/feed/ShareSheet.svelte). */
  .invitesheet {
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
  .invitesheet::backdrop {
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
    scrollbar-width: none;
  }
  .inside::-webkit-scrollbar {
    display: none;
  }
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
    font: var(--text-statement);
  }
  .inside p {
    margin: 0;
  }
  .inside .which {
    margin-top: -0.5rem;
    color: var(--sage);
  }
  /* The link as words, whole on one press, so it can be copied by hand where the clipboard says no. */
  .link {
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius-button);
    box-shadow: var(--glass-edge);
    font: var(--text-small);
    overflow-wrap: anywhere;
    -webkit-user-select: all;
    user-select: all;
  }
  .close {
    flex: none;
    width: var(--size-target);
    padding: 0;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .main {
    width: 100%;
    background: var(--glass-pay);
    box-shadow: var(--glass-edge);
  }
  .said {
    font-weight: 600;
    text-align: center;
  }
  .said:empty {
    margin-block: -0.375rem;
  }
  .faces {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem 0.5rem;
  }
  .faces li {
    display: grid;
    justify-items: center;
    min-width: 0;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-width: var(--size-target);
    min-height: var(--size-target);
    margin: 0;
    padding: 0.25rem 0;
    border-radius: var(--radius-button);
    background: none;
    color: inherit;
    font: var(--text-small);
    box-shadow: none;
  }
  .face .round {
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .on .round {
    box-shadow: 0 0 0 3px var(--sage);
  }
  .tick {
    position: absolute;
    right: -0.375rem;
    bottom: -0.375rem;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-safe);
  }
  .tick svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .face:focus-visible,
  .invitesheet .go:focus-visible {
    outline-color: var(--chalk);
  }
  @media (orientation: portrait) and (max-width: 47.99rem) {
    .invitesheet {
      width: 100vw;
      margin: auto 0 0;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
    .inside {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }

  .stopcard {
    width: min(24rem, calc(100vw - 2rem));
    padding: 1.5rem;
    border: 0;
    border-radius: var(--radius-card);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
  }
  .stopcard h2 {
    margin: 0 0 1rem;
    font: var(--text-statement);
  }
  .stopcard form,
  .stopcard form button,
  .stopcard > button {
    width: 100%;
    margin: 0;
  }
  .stopcard > button {
    margin-top: 0.5rem;
  }
</style>
