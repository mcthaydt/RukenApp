<!--
  A video as members and makers see it: muted and looping where that is welcome (src/lib/quiet-video.ts), the first
  frame otherwise. Choosing it opens it full size in a dialog, on black, with the browser's own controls and a green
  Close at the top right; Escape closes it too. Without script it is a link to the video itself. With no video it is a
  plain sage block. A `still` is a picture and never plays or opens (Your games).
-->
<script lang="ts">
  import Icon from "../../../lib/icon.svelte";
  import { loads } from "../../../lib/loads.ts";
  import { quietVideo } from "../../../lib/quiet-video.ts";

  let {
    src,
    shape,
    still = false,
  }: {
    src: string | null;
    shape: "upright" | "wide";
    still?: boolean;
  } = $props();

  let viewer = $state<HTMLDialogElement>();
  // The full-size video is only in the page while it is open, so a closed one is never fetched and is never a second
  // video beside the first.
  let opened = $state(false);

  function open(event: Event): void {
    event.preventDefault();
    opened = true;
    viewer?.showModal();
  }
</script>

{#if src === null}
  <i class="tile" data-shape={shape} aria-hidden="true"></i>
{:else if still}
  <!-- The first frame is asked for by name: some browsers draw none until a video has been given a time. -->
  <video
    use:loads
    class="tile"
    data-shape={shape}
    src={`${src}#t=0.001`}
    preload="metadata"
    muted
    playsinline
    aria-hidden="true"
  ></video>
{:else}
  <a href={src} onclick={open} aria-label={`Watch the ${shape} video full size`}>
    <video
      use:loads
      class="tile"
      data-shape={shape}
      src={`${src}#t=0.001`}
      preload="metadata"
      muted
      playsinline
      use:quietVideo
    ></video>
  </a>
  <dialog
    class="viewer"
    bind:this={viewer}
    onclose={() => {
      opened = false;
    }}
  >
    {#if opened}
      <!-- A game's videos are silent, so there is nothing to caption. -->
      <!-- svelte-ignore a11y_media_has_caption -->
      <video use:loads {src} controls autoplay playsinline></video>
    {/if}
    <!-- Not a form: the question's own form is around this, and a form inside a form is not allowed. -->
    <button type="button" class="safe" onclick={() => viewer?.close()} aria-label="Close"
      ><Icon name="close" /></button
    >
  </dialog>
{/if}
