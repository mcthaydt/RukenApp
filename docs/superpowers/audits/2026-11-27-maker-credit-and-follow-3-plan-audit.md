# Plan audit 3: maker credit and follow

- Pull request: #400, branch `claude/project-thread-6790hn`
- Reviewed commit: `5072ceb` (spec `docs/superpowers/specs/2026-11-27-maker-credit-and-follow-design.md`), on main `34375a5`
- Lane: 3 (adds a table and a migration). Reviewer: Opus 5.5, medium, a fresh session that wrote neither the brief nor audits 1 and 2.
- Scope: the brief only. `a930a52` (table, follows service, purge) is build code for the implementation audit; it was read only to see what the brief's units plug into.
- Verdict: **FAIL: 2 red**, 2 notes

Prompt: Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Audit 2's findings

- **Red 1, the feed had no viewer identity: fixed.** The Rules bullet "Who is asking for follows is not who the ranker is told" gives `page(after, asking, viewerId: string | null)`, read by `feedServices().viewerOf(caller)`, with `following` and `mine` from `viewerId` and `game.makerUserId`, and `Asking`/`Viewer` unchanged. Checked against the code: `service.ts` line 140 builds the ranker's `Viewer` only from `asking`, `services.ts` lines 41 to 52 still always pass `consented: false`, so the ranker keeps seeing the crowd; `game.makerUserId` is already on every listed game (line 130). Criterion 13 pins it ("the ranker is still handed `{ kind: "crowd" }`"). `viewerOf` is new in `services.ts`, which unit 4 owns. Holds.
- **Note 1 (consent test list): fixed.** `tests/features/consent/cookies.test.ts` gains the name, named in unit 3.
- **Note 2 (worlds.ts, test files): fixed.** `followedAmong` is optional; test files in a Check column belong to their unit; `migration.test.ts` goes to unit 1.
- **Note 3 (cookie used once): fixed.** Deleted on the way back whatever happens (stricter than Wishlist's GET, which deletes it only when it follows; fine).
- **Note 4 (signed out, no script): fixed.** A 303 to `/sign-up?next=…`.
- **Note 5 (where `followedMakerIds` lives): fixed.** `pagesServices().follows.followedMakerIds`, which is where `a930a52` puts it.

## The new change in 5072ceb (the cookie yes)

Checked and holds. `src/features/consent/routes.ts` fails CI for a route in no list, so `/[handle=handle]/follow` must be classed; `GATED` matches by prefix and `OPEN` holds `/[handle=handle]` exactly, so the route is gated once. `gate.ts` lines 73 to 87: a gated JSON request gets `{ go: "/cookies?for=…&next=…" }` (the badge script already follows `{ go }`), and a plain form a 303 to the notice; `/api/` and `/beat` are refused, and `follow` is neither. `actionOfRoute` would answer "account" for the route today, so the brief's `follow` reason in `gate.ts`, `Notice.svelte` (its `Reason` type, line 12) and `src/routes/cookies/+page.server.ts` (its list, line 20) is the whole change, and all three files exist. The words pass the drunk-grandma test.

## Re-checked, and held

- CRUD: create (1), read (2), delete (3) as journeys; no update, with the reason. 
- The migration only adds, `Restrict` keys with rows removed in `deletion.ts`, rollback with the table kept; the unique key serves `followedMakerIds`'s `where followerId` and `followedAmong`.
- The address and the way back mirror `src/routes/g/[game]/wishlist/+server.ts`; `safeNextPath` (`src/lib/safe-next.ts`), `src/lib/busy-forms.ts`, the glass tokens (`look.css` lines 122 to 149), `tests/lib/glass.test.ts`, `tests/routes/privacy/cookies.test.ts` and the consent tests all exist.
- `/api/feed` answers `no-store` and `/` sets no cache header, so a page carrying one person's `following` is never kept for another.
- No live-state file in `5072ceb`.

## Red findings

### 1. The badge's pressable area is below the house size every clip button is held to

- UNIT: the brief, "The plus" and criterion 9.
- VERDICT: red
- REQUIREMENT: consistency with the codebase; `tests/browser/feed.test.ts` (criterion 17, the browser suite passes).
- REASON: the brief says the badge's pressable area is "at least 44 by 44px"; the house target is 48px and an existing journey holds every button on a clip to it.
- EVIDENCE: `src/lib/look.css` line 103, `--size-target: 48px; /* the least height of a button or a field */`; `tests/browser/feed.test.ts` lines 103 to 106 loop over `clip.getByRole("button").all()` on the clip whose maker has a page and expect each box height `>= 48`. A badge built to the brief's 44 fails that journey.
- EXPECTED: the badge's pressable area is at least `var(--size-target)` (48 by 48px), the drawn badge smaller.
- FIX: in the brief, "at least 44 by 44px" becomes "at least 48 by 48px (`--size-target`)" in "The plus" and criterion 9. Files: the spec only.

### 2. The move breaks an existing journey the plan does not name

- UNIT: unit 5, `src/features/feed/Feed.svelte`, and the plan table.
- VERDICT: red
- REQUIREMENT: the review skill ("A pull request that changes or deletes an existing test names each one and why"); CLAUDE.md ("A change does not quietly edit its own check"; the diff touches only files in the plan).
- REASON: moving the maker link from the band to the column puts it, and the new badge, between Play and Share in Tab order, and an existing journey says Share comes straight after Play.
- EVIDENCE: `tests/browser/feed-controls.test.ts` lines 1030 to 1058 Tab through the first clip and expect `names[play + 1]` to be `"Share"`. That clip is whichever game is first, and other files add games with maker pages to the same feed (its own comment, and `feed.test.ts` line 29 `givePage`), so after the move the test fails whenever the first clip has a maker page. Criterion 8 asks for the new order (maker link, badge, Share) but the plan gives no unit this file. Smaller: `feed.test.ts` line 85's comment "The band leads with the maker" goes stale.
- EXPECTED: the plan names `tests/browser/feed-controls.test.ts` (the Tab order journey, now Play, then the maker link and the badge when the clip has a maker, then Share) and `tests/browser/feed.test.ts` (the comment) under unit 5, with why, so the pull request body names them.
- FIX: in the brief, add both files to unit 5's row and one line saying how the Tab order expectation changes. Files: the spec only.

## Notes (not blocking, recorded)

1. **Gated before the yes, signed out.** With no cookie yes and signed out, the press goes to the notice (`next` is `/<handle>/follow`, a GET with no `rk_follow_pressed` cookie, so it goes on to `back`'s default) and the person presses again, which then goes to sign-up. That is what "presses the plus again" says; a journey for it is not among the criteria. Worth one line in criterion 6, or a test in `gate.test.ts` naming `for=follow`, which unit 3 already owns.
2. **The sideways column grows upward.** `.side` is `position: absolute; bottom: 0` sideways (`Feed.svelte` lines 801 to 805), so the credit on top raises the column toward the bar; `sideways-phone.test.ts` line 101 (Share below the bar) still holds, and criterion 9 covers the rest. No change needed; watch it in the build.

## Follow-up outside this change

None found.
