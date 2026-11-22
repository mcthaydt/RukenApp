# Live state: claude/project-thread-jhe4or

- Current task: loading indicators everywhere (owner, 2026-11-22 05:52 UTC: "Make sure we have async loaders for everything that loads, now and in the future"; 05:53 "images and videos too"). Short path, lane 2, Opus 5.5 medium.
- Last commit: 92eed6d (main)
- Next step: write the loading journeys first, then the shared loader pieces in src/lib.
- Open decisions: none. The look (a thin bar for page loads, a spinner on busy buttons, a shimmer on media) is my call, disclosed to the owner.
- Updated: 2026-11-22 05:54 UTC

## Acceptance criteria (copied into the pull request)
1. Moving between pages that wait on the site shows a "Loading…" bar at the top (announced to screen readers) within 200 ms of the wait, and it goes when the page arrives.
2. Every form press shows its button busy (aria-busy, a spinner, the words it already has) and a second press sends nothing. Plain forms get this from one listener in the layout; scripted forms keep their own busy words.
3. Every image and video shows a placeholder until it has loaded, and a moving shimmer while it loads (still for reduced motion).
4. Picking another game on the files question says "Looking up branches…" while GitHub answers.
5. The game frame keeps its "Starting…" screen (already there).
6. A test fails when a new form with script, image, video or frame skips the shared loading pieces.
7. The this-repo skill says every wait shows it.
