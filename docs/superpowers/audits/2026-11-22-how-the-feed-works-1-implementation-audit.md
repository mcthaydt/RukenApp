# How the feed works: implementation audit, round 1

Reviewed: PR #350, branch `claude/project-thread-0t6k1r` at `6f9ed14dbbfbf27292383bac0cea3cb942255075`.
Lane 2, one fresh review (Opus 5.5, medium). Brief: the owner, 2026-11-22 19:57 UTC, "Also include a page for how our
algorithm works", the acceptance criteria in the PR body, and the owner's 20:22 UTC decision that the feed algorithm is
private-sourced while this page stays public.

**Verdict: PASS, 0 red, 6 notes.**

## What was checked

- Scope: `git diff --stat origin/main...6f9ed14` touches 9 files: the new route (`+page.server.ts`, `+page.svelte`), one
  link each in `/help`, `/privacy` and `/terms`, `a.plain-link` in `src/lib/look.css` (8 lines), the new journey, the
  help-guide journey (fourth entry, named in the PR body) and `CLASSES` in `tests/lib/look.test.ts`. Nothing else.
- "How it works today" against the code at the head:
  - Same feed for everyone: `createFeedService.page(after)` takes no viewer. True.
  - New games near the top for their first week: `feedOrder` puts games live under `NEW_GAME_DAYS` (7) first. True.
  - Then members' play decides: the rest sort by `beats` from `memberBeatsByGame`, which counts only `basis = 'member'`
    sessions. True (see note 1 on the time window).
  - Only real play counts, a hidden tab adds nothing: the query counts only `b.attentive` beats. True.
  - A maker's own play and staff play add nothing: `playBasis` returns `own_game` / `staff` first, never `member`. True.
  - Level games swap from day to day: ties break on `seededNumber(day, id)`, the day a Chicago day. True.
  - The feed never ends: `roundOrder` starts a new round when one ends. True.
  - Adult games aren't in the feed: `page` filters `ageRating !== "age_18"`. True.
- "Coming soon" against the owner-approved words (RukenPrivate `strategy/2026-11-15-feed-public-page-draft.md`, which
  spec 6.6 names): every approved section is there in the approved words, under a heading that says it is coming. Two
  lines are added, both true to the spec: the cookie line ("I agree" is the button's word in #344's
  `Notice.svelte:71`) and "We text your parent, and they tap Yes or No" (spec 6.5). "Leaving a game running all night
  adds nothing" was rightly not carried over into "today": attentive beats from a visible tab still count today.
- Private-sourcing: the page has no tuning number (the journey asserts the only digits in the three parts are `18`;
  "first week" is in words and already public in `order.ts`), names no private signal beyond the approved "a few
  touches of our own", and nowhere says the feed's code is public.
- Owner rules: no `<style>` block and no `style=` in the new screen; no `<svelte:head>`/`<title>`, and the journey
  asserts the tab says "Ruken - The Everyday Console"; every link on the page carries `plain-link` (bold, no
  underline), and the journey asserts `text-decoration-line: none` on every link in `main`. Links are 44 px tall through
  the existing `a:not(.button, .wordmark)` rule.
- Drunk-grandma: short sentences, plain words, one action (go back). "Games that are level" is the only slightly odd
  word; acceptable.
- CRUD: the page makes nothing a user can create, so no CRUD journey is owed.
- PR body: has `## Lane` (Lane 2), names the changed tests and why, last line `Requested by **McThayDT**`, no footer.
- Ran at the head in this container: `pnpm install --frozen-lockfile`, `pnpm lint` (exit 0), `pnpm typecheck`
  (0 errors), `vitest run tests/lib/look.test.ts` (136 passed). Browser journeys not run here; CI runs them (draft run
  in progress when this audit was written: shards 1 and 6 green, the rest running).

## Notes (not blocking, recorded for follow-up)

1. UNIT: `src/routes/help/how-the-feed-works/+page.svelte`, "After that, a game moves up when members play it. The more
   they play, the higher it goes." VERDICT: note. REASON: the order counts only the last `PLAYED_DAYS` (7) of play
   (`service.ts`), so a game played a lot last month and not since falls back; the line reads as if play adds up
   forever. EXPECTED: "...when members play it lately". FIX: one word in that file.
2. UNIT: the help list. VERDICT: note. REASON: the new entry is bold and not underlined while the three guides beside it
   still underline, so one list has two link styles; and the list's heading is "Help for makers" while this page is
   for players. EXPECTED: one style for the list. FIX: belongs to the help page redesign (#348), not here.
3. UNIT: merge order. VERDICT: note. EVIDENCE: `git merge-tree pr350 pr348` conflicts in `src/routes/help/+page.svelte`;
   #348 rewrites the help list into three numbered "Help for makers" tiles. EXPECTED: whichever merges second places
   "How the feed works" in the new layout (and keeps the help-guide journey's list in step). #344, #347 and #349
   merge cleanly with this head.
4. UNIT: the page's header comment, "When the feed changes, this page changes in the same pull request". VERDICT: note.
   REASON: with the ranking moving to RukenPrivate, a feed change there cannot change this page in the same pull
   request. EXPECTED: the private-feed spec's unit that replaces `order.ts` updates "today" here in its RukenApp pull
   request, in words only, never the private numbers (the "first week" line must not start tracking a private value).
5. UNIT: "What we never do", "Every number we show, like plays and likes, comes from real people." VERDICT: note.
   REASON: likes are not shown yet (unit G), and the checks that keep fake plays out are not built yet. It is the
   owner-approved promise, so it stays; it becomes fully true when G and the private fraud checks land.
6. UNIT: the way back. VERDICT: note. REASON: the owner asked for an icon on its own wherever it is clear (2026-11-22
   18:04 UTC); this page uses words ("Back to help"), as every help guide on main does today, and #348 moves the help
   index to an arrow. EXPECTED: the guides follow when the help pages are restyled; not this change's scope.
