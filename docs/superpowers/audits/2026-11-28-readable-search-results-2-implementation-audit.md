# Readable Search results: lane 2 review 2

Pull request #451, head `5bd3f05` (5bd3f052587c211f03e35830ed5a89b3a3c392e5), code commit `5a41573`, base `main` at `04689e5` (the branch is 24 commits behind it). Fresh session, Opus 5.5, medium. Reviewed 2026-11-28 08:49 UTC. Review 1 (`19e35d6`, audit `0bcb429`) failed with 2 red.

**Verdict: FAIL, 1 red.** The fix is right, the journey fails by itself on the old card, nothing overlaps, and the body is fixed. The journey still leaves out 17 reachable screens with words (a maker's question screens for their game, their page's rooms and link editors, take-down) and every list with something in it, so "every word on every screen" is not yet what it checks. All of them are readable today (probe below), so the fix is in the test only.

## What ran

All in this container: WebKit from the Playwright 1.63.0 image as `run-server` (project `phone`), Postgres 16, the built app under `wrangler dev`, the repo's config with `globalSetup` dropped and `connectOptions` set.

| Run | Result |
| --- | --- |
| `text-contrast.test.ts` at `5bd3f05` | 12 passed (3.0 m): 4 sizes × signed out, player, maker, each after launch and before |
| `text-contrast.test.ts` at 375×667 with `Search.svelte` put back to `main`'s | 3 failed of 3: on `/search?q=<game>`, for all three people, before and after launch, name, line and "by Night Owl Games" each 1.05:1 (`#34454c` on `#004f46`). The journey fails by itself on the old code. |
| Probe (not committed), the journey's own check at 375×667 and 667×375, before and after launch, on screens it leaves out (list in R1) | 8 passed. No faint word; every screen had words measured. |
| `controls-overlap.test.ts` with `/search?q=<game>` and Search's nothing-found added to its signed-out and signed-in lists (not committed) | 3 passed (1.7 m): no two controls overlap at 320×568, 375×667, 667×375, before and after launch. |
| PR CI at `5bd3f05` | quick draft run: every job green, `gate (quick, draft)` success, `commit-authors` success, `pr-rules-run` success. The full run has not run (still a draft). |

## Review 1's findings

- R1 (coverage): partly fixed. A signed-in player and before launch are now read, and 24 / 20 / 23 screens. What is still missing is R1 below.
- R2 (body): fixed. The body starts with the attribution lines and its last line is `Requested by **McThayDT**`; no footer.
- N2 (Search's borrowed `row` and `line`): fixed, now `result` and `oneline`. Checked: no rule in `look.css` styles `.result`, `.found` or `.oneline`.

## Red findings

### R1. The journey still leaves out 17 screens with words, and every filled list

UNIT: `tests/browser/text-contrast.test.ts`. VERDICT: red. REQUIREMENT: the owner's goal (2026-11-28 07:46: every word on every screen is checked, the PR's title), review 1 R1's EXPECTED ("every route that renders words for that person"), and the coordinator's brief for this review (empty states and states besides). REASON: the maker's list stops at `/make/<game>`, `/make/page` and `/make/page/links`, and no list in the journey ever holds anything. EVIDENCE: `makersOwn()` (3 paths); routes under `src/routes` that render words for a maker with a live game and a page and are never read: `/make/<game>/name`, `/line`, `/files`, `/upright`, `/wide`, `/age`, `/websites`, `/take-off`; `/make/page/address`, `/name`, `/line`, `/colours`, `/photo`; `/make/page/links/add`, `/make/page/links/<link>`; `/make/page/take-down`. A draft game's own screens are never read either: `/make/<draft>/agreement`, `/check`, `/marks`, `/throw-away` (for a live game they lead to its page or to "We can't find that page", seen in the probe). Filled states: Saved and Reposts are read only empty (the player has none; the maker's are empty too), and Your turn only with nothing sent, so a result card on them, the exact kind of card that broke on Search, is never measured. The probe read the 17 screens above and Saved and Reposts with a game in them: all readable. EXPECTED: the maker's list covers every `/make/<game>/<question>` that answers for a live game, `take-off`, every page room, adding and changing a link, and take-down; a draft game (`addDraft`) is read on its question screens, agreement, check, marks and throw-away; the player has a game saved and reposted (as `feed-marks.test.ts` presses them) and one sent to them by a friend (`makeFriends`, as the Your turn journeys do), so Saved, Reposts and Your turn are read with a card in them. FIX: `tests/browser/text-contrast.test.ts` only (and criterion 3 of the body, to name what it covers). No app change: the probe found nothing faint.

## Notes (not blocking)

- N1. Words that only appear after an action are not read: a sheet (glass, `glass.test.ts`'s), and a form's error or "Saved" line (for example a wrong sign-in code, a taken page address). The body's criterion 4 says so. A form's error words on a card are the next most likely faint text; worth a follow-up that reads one error per form.
- N2. Pages still to land must join the lists in their own pull requests: the parent's-yes pages ("Build parent's yes for teen feeds") and the playtesting pages (spec `2026-11-28-playtesting-design.md`: Ask / You asked / Take back on the game page, the maker's Playtesters dashboard). Each brief should name `text-contrast.test.ts` in its criteria.
- N3. The check reads each text node's first line on screen at its middle, and skips a word with any background image or frosted glass anywhere behind it in the stack. A screen whose own body or card took a gradient would be skipped word by word; the "words measured" guard only catches a screen with none at all. No such screen today.
- N4. The branch is 24 commits behind `main` (`04689e5`); it needs `main` merged in before it merges, and a clean merge carries a pass.

## CRUD

Nothing a person makes is added or changed. No CRUD journey needed.
