<!--
  What players will see, beside a question (spec 15.4): one paper card with the game's two videos, its name, its one
  line and who it is for. A part not answered yet is words in grey, so the maker sees what is still to come. It follows
  what she types and picks; without script it shows what is saved. Only a window wide enough for it draws it: a phone,
  a phone held sideways and a tablet held upright give the question the whole screen. The maker's handle is not here:
  nobody has one yet.
-->
<script lang="ts">
  import { previewOfPage } from "./preview.svelte.ts";
  import VideoTile from "./VideoTile.svelte";

  const preview = previewOfPage();
</script>

{#if preview !== undefined}
  <aside class="preview">
    <p>{preview.waits ? "What players will see after we say yes" : "What players will see"}</p>
    <div class="card">
      <div>
        <VideoTile src={preview.video} shape="upright" still />
        <VideoTile src={preview.wideVideo} shape="wide" still />
      </div>
      <h2 data-empty={preview.name === "" ? "" : undefined}>
        {preview.name === "" ? "Its name" : preview.name}
      </h2>
      <p data-empty={preview.oneLine === "" ? "" : undefined}>
        {preview.oneLine === "" ? "Its one line" : preview.oneLine}
      </p>
      {#if preview.rating !== null}
        <span class="chip">{preview.rating}</span>
      {/if}
    </div>
  </aside>
{/if}
