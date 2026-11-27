<!--
  Ruken's own share sheet (the owner, 2026-11-24: "our share uses native and not a custom share"): a glass panel over a
  dimmed screen, the same kind as the Report sheet. One main button copies the game's link; under it, round buttons
  open a text, WhatsApp or X with the link written in, or copy it and open Instagram to paste it; "Your turn" (in
  Email's old place, the owner, 2026-11-27 14:48 UTC) turns the sheet into a list of friends to pick and send the game
  to; and "More" hands over to the phone's own share sheet where the browser has one. The link stays on show as words, so it can always be copied by hand. One sheet
  serves a whole screen: the screen calls `open` with the game and the button that was pressed.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "../../lib/icon.svelte";
  import { SendPicker, SEND_WORDS, type Friend } from "../sends/sends.browser.ts";
  import { copyLink, shareByPhone, shareTargets, type ShareLink, type ShareTools } from "./share.ts";

  // The person's friends, for Your turn; null when signed out.
  let { friends = null }: { friends?: readonly Friend[] | null } = $props();

  // Whether the sheet shows the friends to pick (Your turn) instead of the link and the apps.
  let picking = $state(false);
  let picker = $state<{ focusFirst: () => void }>();
  let yourTurnButton = $state<HTMLButtonElement>();

  async function pickFriends(): Promise<void> {
    picking = true;
    await tick();
    picker?.focusFirst();
  }

  async function backToApps(): Promise<void> {
    picking = false;
    await tick();
    yourTurnButton?.focus();
  }

  let sheet = $state<HTMLDialogElement>();
  let copyButton = $state<HTMLButtonElement>();
  let link = $state<ShareLink | null>(null);
  let slug = $state("");
  let opener: HTMLElement | null = null;
  // Whether this browser has a share sheet of its own, for "More". Asked at each open: a test or a browser may change it.
  let phoneSheet = $state(false);
  let said = $state("");
  // True while the sheet slides away; it closes for real when that ends.
  let closing = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

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
    slug = game.slug;
    opener = from;
    said = "";
    picking = false;
    phoneSheet = typeof navigator.share === "function";
    finishClosing();
    sheet?.showModal();
    // The one main action takes the focus, not the cross that comes first.
    copyButton?.focus();
  }

  /** Copies the link and says so. `then` is said after "Link copied." when the link is to be pasted somewhere. */
  async function copy(then = ""): Promise<void> {
    if (link === null) return;
    const result = await copyLink(tools(), link.url);
    if (result === "copied") said = then === "" ? "Link copied." : `Link copied. ${then}`;
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

  /** Slides the sheet away and fades the dimmed screen, then closes it. With reduced motion it closes at once. */
  function close(): void {
    if (sheet === undefined || !sheet.open || closing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sheet.close();
      return;
    }
    closing = true;
    // In case the slide never reports its end (a hidden tab, say), it still closes.
    closeTimer = setTimeout(finishClosing, 400);
  }

  function finishClosing(): void {
    clearTimeout(closeTimer);
    if (!closing) return;
    closing = false;
    sheet?.close();
  }
</script>

<!-- A press on the dimmed screen around the panel closes it; the keyboard has Escape and the cross. -->
<!-- Never a Tab stop of its own: WebKit otherwise stops on the sheet itself between its buttons, a stop the pad's
     arrows cannot reach (implementation audit 1 of Your turn, R2). -->
<dialog
  class="sharesheet"
  tabindex="-1"
  bind:this={sheet}
  aria-labelledby="share-title"
  class:closing
  onclick={(event) => {
    if (event.target === sheet) close();
  }}
  oncancel={(event) => {
    // Escape slides it away too, where the browser lets the page do that; otherwise it closes at once.
    if (!event.cancelable) return;
    event.preventDefault();
    close();
  }}
  onanimationend={(event) => {
    if (event.target === sheet && closing) finishClosing();
  }}
  onclose={() => {
    clearTimeout(closeTimer);
    closing = false;
    opener?.focus();
  }}
>
  <div class="inside">
    <div class="top">
      <h2 id="share-title">{picking ? SEND_WORDS.pickTitle : "Share"}</h2>
      <button type="button" class="close" aria-label="Close" onclick={close}><Icon name="close" /></button>
    </div>
    {#if link !== null}
      <p class="which">{link.title}</p>
    {/if}
    {#if picking}
      <SendPicker bind:this={picker} game={slug} {friends} onback={() => void backToApps()} />
    {:else}
      {#if link !== null}
        <p class="link">{link.url}</p>
      {/if}
      <button type="button" class="main" bind:this={copyButton} onclick={() => void copy()}>Copy link</button>
      <p class="said" role="status">{said}</p>
      <ul class="apps">
        {#each targets as target (target.key)}
          {#if target.key === "x"}
            <li>
              <button type="button" class="app" bind:this={yourTurnButton} onclick={() => void pickFriends()}>
                <span class="round" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
                    <path d="M4 12l16-8-6 16-2.5-6.5L4 12zM11.5 13.5L20 4" />
                  </svg>
                </span>
                <span>{SEND_WORDS.shareApp}</span>
              </button>
            </li>
          {/if}
          <li>
            <a
              class="app"
              href={target.href}
              target={target.href.startsWith("https:") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onclick={() => {
                // The copy starts inside the press, as the clipboard asks; the app opens beside the sheet.
                if (target.pasteFirst) void copy(`Paste it in ${target.words}.`);
              }}
            >
              <span class="round" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
                  {#if target.key === "text"}
                    <path d="M4 5h16v11H10l-6 4V5z" />
                  {:else if target.key === "whatsapp"}
                    <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z" />
                    <path
                      d="M9 8.5c0 3.5 3 6.5 6.5 6.5l.8-1.6-2-1-1 1c-1.3-.5-2.7-1.9-3.2-3.2l1-1-1-2L9 8.5z"
                    />
                  {:else if target.key === "instagram"}
                    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <path class="dots" d="M17 7h.01" />
                  {:else}
                    <path d="M4.5 4h4L19.5 20h-4zM19 4l-6.2 7M5 20l6.2-7" />
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
    {/if}
  </div>
</dialog>

<style>
  /* The screen behind is dimmed and blurred; the panel is glass over it. On an upright phone it sits on the bottom edge,
     elsewhere in the middle. It is never taller than the window: what does not fit scrolls inside it. */
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
  /* It slides up and fades in, and the screen behind dims with it; closing plays it backwards, a little quicker. The
     easing is the app's own, written out too, since the feed is not inside the `.screen` that look.css sets it on. */
  .sharesheet[open] {
    animation: share-in 320ms var(--ease, cubic-bezier(0.32, 0.72, 0, 1)) backwards;
  }
  .sharesheet[open]::backdrop {
    animation: share-dim 320ms var(--ease, cubic-bezier(0.32, 0.72, 0, 1)) backwards;
  }
  .sharesheet.closing {
    animation: share-out 220ms var(--ease, cubic-bezier(0.32, 0.72, 0, 1)) forwards;
  }
  .sharesheet.closing::backdrop {
    animation: share-undim 220ms var(--ease, cubic-bezier(0.32, 0.72, 0, 1)) forwards;
  }
  .sharesheet::backdrop {
    background: var(--dim-bg);
    -webkit-backdrop-filter: var(--dim-filter);
    backdrop-filter: var(--dim-filter);
  }
  @keyframes share-in {
    from {
      opacity: 0;
      transform: translateY(2.5rem);
    }
  }
  @keyframes share-out {
    to {
      opacity: 0;
      transform: translateY(2.5rem);
    }
  }
  /* On an upright phone it comes up from, and goes back down past, the bottom edge. */
  @keyframes share-up {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
  }
  @keyframes share-down {
    to {
      opacity: 0;
      transform: translateY(100%);
    }
  }
  @keyframes share-dim {
    from {
      opacity: 0;
    }
  }
  @keyframes share-undim {
    to {
      opacity: 0;
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
  /* Empty, it takes no room but the gap, and stays in place so a screen reader hears what it says next. */
  .said:empty {
    margin-block: -0.375rem;
  }
  .apps {
    display: grid;
    /* Six to a row where there is room, three to a row on an upright phone (below), so no app stands alone. */
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.75rem 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .apps > li {
    display: flex;
  }
  /* Each app is a round glass button with its name under it; the whole of it is the press. */
  .app {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-height: var(--size-target);
    /* Not the pull-in margins a link in a line of words gets (look.css): this one stands on its own. */
    margin: 0;
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
    --corner: round;
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
    .sharesheet.closing {
      animation-name: share-down;
    }
    .apps {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .inside {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sharesheet[open],
    .sharesheet[open]::backdrop {
      animation: none;
    }
  }
</style>
