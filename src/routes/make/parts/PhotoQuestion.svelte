<!--
  "Add a photo for your page": the photo that is there (or a plain circle) and the blue button, which is Ruken's own
  picker over the real file field, so the keyboard reaches it. With script a chosen picture is cut to a square and
  made small before it is sent, and is sent at once; without script the maker chooses a file and presses "Save photo".
  "Remove photo" is the quiet way out, only when there is a photo to remove.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { cropSquare, PHOTO_SIDE } from "../../../features/pages/pages.browser.ts";
  import { showTheRefusal } from "../../../lib/focus.ts";
  import QuestionScreen from "./QuestionScreen.svelte";

  let { photo, problem }: { photo: string | null; problem: string | undefined } = $props();

  let saving = $state(false);
  let woke = $state(false);
  let field = $state<HTMLInputElement>();
  let adder = $state<HTMLButtonElement>();
  const shown = $derived(saving ? null : (problem ?? null));

  $effect(() => {
    if (shown !== null) showTheRefusal();
  });

  onMount(() => {
    woke = true;
    // A photo chosen before the script had run is still in the field, and the button that would send it has gone.
    if (field !== undefined && (field.files?.length ?? 0) > 0) void takeChoice(field);
  });

  /** The picture cut to a square of 512 pixels at most, as a JPEG, or null when the browser cannot read it. */
  async function squared(file: File): Promise<File | null> {
    try {
      const picture = await createImageBitmap(file);
      const { x, y, side } = cropSquare(picture.width, picture.height);
      const size = Math.min(side, PHOTO_SIDE);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (context === null) return null;
      // A picture with see-through parts would turn black as a JPEG.
      context.fillStyle = "white";
      context.fillRect(0, 0, size, size);
      context.drawImage(picture, x, y, side, side, 0, 0, size, size);
      const blob = await new Promise<Blob | null>((done) => {
        canvas.toBlob(done, "image/jpeg", 0.9);
      });
      return blob === null ? null : new File([blob], "photo.jpg", { type: "image/jpeg" });
    } catch {
      // Not a picture the browser can read: it goes as it is, and the server says so in words.
      return null;
    }
  }

  async function takeChoice(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (file === undefined) return;
    const cut = await squared(file);
    if (cut !== null) {
      const swap = new DataTransfer();
      swap.items.add(cut);
      input.files = swap.files;
    }
    input.form?.requestSubmit(adder);
  }
</script>

<QuestionScreen
  heading="Add a photo for your page"
  title="Your page · Ruken"
  counter={null}
  back="/make/page"
  enterHint={false}
  bind:saving
  forward={picker}
>
  {#if photo !== null}
    <img class="yourphoto" src={photo} alt="Shown at the top of your page" width="96" height="96" />
  {/if}
  <p class="note" id="hint">Players see it at the top of your page. A JPEG, PNG or WebP, up to 5 MB.</p>
  {#if photo !== null}
    <button class="quiet" formaction="?/remove">Remove photo</button>
  {/if}
  {#if saving}
    <p class="note" role="status">Adding your photo.</p>
  {/if}
  {#if shown !== null}
    <p class="problem" id="problem" role="alert">{shown}</p>
  {/if}
</QuestionScreen>

{#snippet picker()}
  <label class="file">
    <input
      type="file"
      name="photo"
      id="photo-file"
      accept="image/jpeg,image/png,image/webp"
      disabled={saving}
      aria-busy={saving}
      aria-labelledby="photo-words"
      aria-describedby={shown === null ? "hint" : "hint problem"}
      aria-invalid={shown === null ? undefined : "true"}
      bind:this={field}
      onchange={(event) => {
        void takeChoice(event.currentTarget);
      }}
    />
    <span id="photo-words"
      >{saving ? "Adding your photo…" : photo === null ? "Choose photo" : "Choose a different photo"}</span
    >
  </label>
  <!-- The button without script. With script the field sends itself, and this one only says where to send it. -->
  <button hidden={woke} bind:this={adder} formaction="?/photo" formenctype="multipart/form-data">
    Save photo
  </button>
{/snippet}
