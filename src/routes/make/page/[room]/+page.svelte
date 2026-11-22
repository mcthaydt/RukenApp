<!--
  One room of your page, on the felt: the address, the name, the one line, the photo or the colours. Each is its own
  heading, answer and hint, with Save, and Back goes to the rooms.
-->
<script lang="ts">
  import { cropSquare, PHOTO_SIDE } from "../../../../features/pages/pages.browser.ts";
  import ThemePicker from "../../../../features/pages/ThemePicker.svelte";
  import QuestionScreen from "../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const BACK = "/make/page";

  /**
   * With script, the picture is cut to a square no bigger than PHOTO_SIDE before it is sent, so a phone's big photo goes
   * as a small one. A file the browser cannot draw is sent as it is, and the server says what is wrong with it.
   */
  async function cutPhoto(data: FormData): Promise<void> {
    const file = data.get("photo");
    if (!(file instanceof File) || file.size === 0) return;
    try {
      const picture = await createImageBitmap(file);
      const { x, y, side } = cropSquare(picture.width, picture.height);
      const size = Math.min(side, PHOTO_SIDE);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d")?.drawImage(picture, x, y, side, side, 0, 0, size, size);
      const blob = await new Promise<Blob | null>((done) => {
        canvas.toBlob(done, "image/jpeg", 0.9);
      });
      if (blob !== null) data.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
    } catch {
      // Not a picture the browser can read: the server will say so in its own words.
    }
  }
</script>

{#key data.room}
  {#if data.room === "address"}
    <QuestionScreen title="Your page · Ruken" heading="Pick your page's address" counter={null} back={BACK}>
      <TextAnswer
        name="handle"
        value={form?.handle ?? data.handle}
        hint={`People find your page at ${data.host}/yourname. Use letters, numbers and hyphens.`}
        problem={form?.problem}
      />
    </QuestionScreen>
  {:else if data.room === "name"}
    <QuestionScreen
      title="Your page · Ruken"
      heading="What should your page call you?"
      counter={null}
      back={BACK}
    >
      <TextAnswer
        name="name"
        value={form?.name ?? data.name}
        hint="It is the big name at the top of your page."
        problem={form?.problem}
      />
    </QuestionScreen>
  {:else if data.room === "line"}
    <QuestionScreen title="Your page · Ruken" heading="Say one line about you" counter={null} back={BACK}>
      <TextAnswer
        name="line"
        grows
        value={form?.line ?? data.oneLine}
        hint="It sits under your name on your page. Like: I make small, hard games."
        problem={form?.problem}
      />
    </QuestionScreen>
  {:else if data.room === "photo"}
    <QuestionScreen
      title="Your page · Ruken"
      heading="Add a photo for your page"
      counter={null}
      back={BACK}
      enctype="multipart/form-data"
      enterHint={false}
      submit={cutPhoto}
      quiet={data.photo === null ? undefined : { words: "Remove photo", action: "?/removePhoto" }}
    >
      {#if data.photo !== null}
        <img src={data.photo} alt="What your page shows now" width="96" height="96" />
      {/if}
      <input
        class="answer"
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        aria-labelledby="question"
        aria-describedby={form?.problem === undefined ? "hint" : "hint problem"}
        aria-invalid={form?.problem === undefined ? undefined : "true"}
      />
      <p class="note" id="hint">Players see it at the top of your page. A JPEG, PNG or WebP, up to 5 MB.</p>
      {#if form?.problem !== undefined}
        <p class="problem" id="problem" role="alert">{form.problem}</p>
      {/if}
    </QuestionScreen>
  {:else}
    <QuestionScreen
      title="Your page · Ruken"
      heading="Pick your page's colours"
      counter={null}
      back={BACK}
      enterHint={false}
    >
      <ThemePicker themes={data.themes} chosen={data.themeId} problem={form?.problem} />
      <p class="note" id="hint">You can change them any time.</p>
      {#if form?.problem !== undefined}
        <p class="problem" id="problem" role="alert">{form.problem}</p>
      {/if}
    </QuestionScreen>
  {/if}
{/key}
