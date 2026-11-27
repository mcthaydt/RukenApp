<!--
  Says that what is behind the bar and the buttons moves here (a clip, a game, a wall of clips), so they are drawn as
  glass. Put it inside whatever moves, where it shows: while it is on the page, `<html>` carries `data-glass` and
  look.css draws the glass; on a page without it, the bar and every button are solid in the same colours (the owner,
  2026-11-27: "The glass button effect should not be for pages with a static color background").

  The mark is on `<html>` itself, not found by the stylesheet with `:has()`: a rule that searched the page from the top
  held Safari's engine back on the feed, whose first frame on a phone came after the 5-second wait in CI (run
  45947646204). A page sent from the server carries a `<meta name="glass">` in its head, and the line in app.html right
  after the head marks `<html>` before anything is drawn; once the page is running, this keeps the mark while any moving
  screen is on it.
-->
<script lang="ts" module>
  let onPage = 0;
</script>

<script lang="ts">
  $effect(() => {
    onPage += 1;
    document.documentElement.setAttribute("data-glass", "");
    return () => {
      onPage -= 1;
      if (onPage === 0) document.documentElement.removeAttribute("data-glass");
    };
  });
</script>

<svelte:head>
  <meta name="glass" content="moving" />
</svelte:head>
