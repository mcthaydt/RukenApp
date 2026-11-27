<!--
  Says that what is behind the bar and the buttons moves here (a clip, a game, a wall of clips), so they are drawn as
  glass. Put it inside whatever moves, where it shows: while it is on the page, look.css draws the glass; on a page
  without it, the bar and every button are solid in the same colours (the owner, 2026-11-27: "The glass button effect
  should not be for pages with a static color background").

  The mark is a line in the page's head, not an attribute on the moving thing, so the stylesheet finds it by looking at
  the head's own children. Searching the whole page for an attribute made Safari's engine look again at every change on
  a busy feed, which held the phone's first frame of the feed back by about two seconds (run 45947646204).
-->
<svelte:head>
  <meta name="glass" content="moving" />
</svelte:head>
