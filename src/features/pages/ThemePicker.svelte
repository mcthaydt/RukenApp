<!--
  The colours to pick from for a page: one tile for Ruken's own colours and one for each combination the book gives a
  readable page. A tile is a real radio button laid over a swatch: the ground of that page, "Aa" in its text colour and
  a bar in its button colours, so a maker sees what the page will wear. Each is named for its number, as the rooms name
  it. It lives here, not in a screen, because the tiles' colours are the pages' own and a screen writes no colour.
-->
<script lang="ts">
  import { DEFAULT_THEME, THEMES } from "./pages.browser.ts";

  let {
    name,
    chosen,
    describedBy,
  }: {
    name: string;
    chosen: number;
    /** The ids of the lines under the tiles that a reader should hear with them. */
    describedBy?: string | undefined;
  } = $props();

  const choices = [DEFAULT_THEME, ...THEMES];
</script>

<fieldset class="themes" aria-labelledby="question" aria-describedby={describedBy}>
  {#each choices as theme (theme.id)}
    <label class="theme" style:--ground={theme.ground} style:--text={theme.text}>
      <input type="radio" {name} value={String(theme.id)} checked={theme.id === chosen} />
      <span class="aa" aria-hidden="true">Aa</span>
      <i aria-hidden="true" style:background={theme.button}></i>
      <span class="name">{theme.id === 0 ? "Ruken's own colours" : `Colours ${String(theme.id)}`}</span>
    </label>
  {/each}
</fieldset>
