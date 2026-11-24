<!--
  Ruken's own share sheet (the owner, 2026-11-24: "our share uses native and not a custom share"): a glass panel over a
  dimmed screen, the same kind as the Report sheet. One main button copies the game's link; under it, round buttons
  open a text, WhatsApp, an email, X or Facebook with the link written in, and "More" hands over to the phone's own
  share sheet where the browser has one. The link stays on show as words, so it can always be copied by hand. One sheet
  serves a whole screen: the screen calls `open` with the game and the button that was pressed.
-->
<script lang="ts">
  import Icon from "../../lib/icon.svelte";
  import { copyLink, shareByPhone, shareTargets, type ShareLink, type ShareTools } from "./share.ts";

  let sheet = $state<HTMLDialogElement>();
  let copyButton = $state<HTMLButtonElement>();
  let link = $state<ShareLink | null>(null);
  let opener: HTMLElement | null = null;
  // Whether this browser has a share sheet of its own, for "More". Asked at each open: a test or a browser may change it.
  let phoneSheet = $state(false);
  let said = $state("");

  const targets = $derived(link === null ? [] : shareTargets(link));

  /** The browser's tools, asked at the moment they are needed. A page that is not on https has no clipboard. */
  function tools(): ShareTools {
    const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
    return {
      share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
      copy: clipboard === undefined ? undefined : (text) => clipboard.writeText(text),
    };
  }

  /** Opens the sheet for a game. Focus goes back to `from` when it closes. */
  export function open(game: { slug: string; name: string }, from: HTMLElement | null): void {
    link = { title: game.name, url: `${location.origin}/g/${game.slug}` };
    opener = from;
    said = "";
    phoneSheet = typeof navigator.share === "function";
    sheet?.showModal();
    // The one main action takes the focus, not the cross that comes first.
    copyButton?.focus();
  }

  async function copy(): Promise<void> {
    if (link === null) return;
    const result = await copyLink(tools(), link.url);
    if (result === "copied") said = "Link copied.";
    else if (matchMedia("(pointer: coarse)").matches) said = "Press and hold the link above to copy it.";
    else said = "Select the link above to copy it.";
  }

  async function more(): Promise<void> {
    if (link === null) return;
    said = "";
    const result = await shareByPhone(tools(), link);
    if (result === "shared") close();
    else if (result === "failed") said = "That didn't work. Copy the link instead.";
  }

  function close(): void {
    sheet?.close();
  }
</script>

<!-- A press on the dimmed screen around the panel closes it; the keyboard has Escape and the cross. -->
<dialog
  class="sharesheet"
  bind:this={sheet}
  aria-labelledby="share-title"
  onclick={(event) => {
    if (event.target === sheet) close();
  }}
  onclose={() => {
    opener?.focus();
  }}
>
  <div class="inside">
    <div class="top">
      <h2 id="share-title">Share</h2>
      <button type="button" class="close" aria-label="Close" onclick={close}><Icon name="close" /></button>
    </div>
    {#if link !== null}
      <p class="which">{link.title}</p>
      <p class="link">{link.url}</p>
    {/if}
    <button type="button" class="main" bind:this={copyButton} onclick={() => void copy()}>Copy link</button>
    <p class="said" role="status">{said}</p>
    <ul class="apps">
      {#each targets as target (target.key)}
        <li>
          <a
            class="app"
            href={target.href}
            target={target.href.startsWith("https:") ? "_blank" : undefined}
            rel="noopener noreferrer"
          >
            <span class="round" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
                {#if target.key === "text"}
                  <path d="M4 5h16v11H10l-6 4V5z" />
                {:else if target.key === "whatsapp"}
                  <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z" />
                  <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l.8-1.6-2-1-1 1c-1.3-.5-2.7-1.9-3.2-3.2l1-1-1-2L9 8.5z" />
                {:else if target.key === "email"}
                  <path d="M3.5 6h17v12h-17zM3.5 6l8.5 7 8.5-7" />
                {:else if target.key === "x"}
                  <path d="M4.5 4h4L19.5 20h-4zM19 4l-6.2 7M5 20l6.2-7" />
                {:else}
                  <path d="M14 21v-8h3l.5-3.5H14V7.6c0-1 .4-1.6 1.7-1.6h1.8V3H15c-3 0-4.5 1.7-4.5 4.4v2.1H8V13h2.5v8" />
                {/if}
              </svg>
            </span>
            <span>{target.words}</span>
          </a>
        </li>
      {/each}
      {#if phoneSheet}
        <li>
          <button type="button" class="app" onclick={() => void more()}>
            <span class="round" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
                <path class="dots" d="M6 12h.01M12 12h.01M18 12h.01" />
              </svg>
            </span>
            <span>More</span>
          </button>
        </li>
      {/if}
    </ul>
  </div>
</dialog>

<style>
  /* The screen behind is dimmed and blurred; the panel is glass over it. On an upright phone it rises from the bottom,
     elsewhere it grows in the middle. It is never taller than the window: what does not fit scrolls inside it. */
  .sharesheet {
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
  .sharesheet[open] {
    animation: share-in 280ms var(--ease) backwards;
  }
  .sharesheet::backdrop {
    background: var(--dim-bg);
    -webkit-backdrop-filter: var(--dim-filter);
    backdrop-filter: var(--dim-filter);
  }
  @keyframes share-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
  }
  @keyframes share-up {
    from {
      opacity: 0;
      transform: translateY(2rem);
    }
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
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font: var(--text-statement);
  }
  p {
    margin: 0;
    font: var(--text-body);
  }
  .which {
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
    padding: 0;
    width: var(--size-target);
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
    display: none;
  }
  .apps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Each app is a round glass button with its name under it; the whole of it is the press. */
  .app {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-height: var(--size-target);
    padding: 0.25rem 0;
    border: 0;
    border-radius: var(--radius-button);
    background: none;
    color: inherit;
    font: var(--text-small);
    text-decoration: none;
    box-shadow: none;
    cursor: pointer;
  }
  .round {
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    border-radius: 50%;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .round svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: var(--glass-icon);
  }
  .round .dots {
    stroke-width: 3.5;
  }
  .app:focus-visible {
    outline-color: var(--chalk);
  }
  @media (orientation: portrait) and (max-width: 47.99rem) {
    .sharesheet {
      width: 100vw;
      margin: auto 0 0;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
    .sharesheet[open] {
      animation-name: share-up;
    }
    .inside {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sharesheet[open] {
      animation: none;
    }
  }
</style>
