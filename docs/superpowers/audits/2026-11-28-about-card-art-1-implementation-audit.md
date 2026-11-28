# About page card art: implementation audit, round 1

- Pull request: #446, "About page: photos of friends behind the closing cards, and today's feed in the phone"
- Commit examined: `bb9015d` (bb9015db5de4ad5e42690f28a4b21ba6b7619d5e)
- Lane: 2 (`src/lib/look.css`). One fresh review after the build.
- Reviewer: Opus 5.5, medium, fresh session.
- Verdict: **PASS**. 0 red, 3 notes.

## What ran

| Check | How | Result |
| --- | --- | --- |
| CI at `bb9015d` | `gh api …/commits/bb9015d/check-runs` | verify, postgres, 6 browser shards, gate, commit-authors, pr-rules: all success (quick, draft run) |
| New journey "on the about page, the corner button never sits on another button…" | Local site (verify skill), Playwright 1.63. `phone` = iPhone SE in **WebKit** (Playwright 1.63.0 docker run-server), `tablet` = iPad in Chromium. No retries. | 2 passed |
| Same journey fails by itself | PR's changes to `+page.svelte` and `look.css` reverted, site rebuilt, journey re-run | Fails in both engines: "Put your game on Ruken / Back to the feed" at 864 and 912, "Watch the feed / Back to the feed" at 7440, 7488, and more, at 320 by 568. Code restored after. |
| `controls-overlap.test.ts`, `about.test.ts`, `real-buttons.test.ts` | Same setup, both projects | 83 passed, 1 failed once (note 3), passed when re-run alone |
| `tests/lib/look.test.ts`, `glass.test.ts`, `still-poster.test.ts` | vitest | 195 passed |
| Contrast on the closing cards | Probe: each card shot with its heading and button made see-through, 95th-percentile brightest pixel behind each, against their white words. 320 by 568, 375 by 667, 667 by 375, 1280 by 720, Chromium and WebKit, reduced motion | Lowest 6.21:1 ("Put your game on Ruken", 1280 by 720, WebKit). Every heading at least 8.8:1. All above 4.5:1. |
| Heading and button inside the card | Same probe, boxes against the card's box | Inside on all 16 card shots |
| Brand logos and trademarks | Full images and 3x crops of the phones, laptops, watch and notebooks | None seen. Phone backs and laptop lids show no logo; the screens show made-up games. The feed shot shows only Ruken's own UI and Floor Fifty. |
| Image weight | Sizes and headers read with Pillow | `friends-playing.jpg` 1200x675, 57 KB; `friends-making.jpg` 1200x675, 107 KB; `feed.jpg` 600x1298, 110 KB. All progressive JPEG with no EXIF or generator metadata. The cards load lazily. 1200 wide covers the largest card (568 css px plus its 4rem bleed) at 2x. |
| Glass and style rules | Diff read; glass and look unit tests | No new colour, gradient or see-through surface. Only the blur changes (18px to 2px). No underlines added. |
| Lint, typecheck | CI `verify` at `bb9015d` | Pass. (A local run picked up this reviewer's own temporary Playwright config and build output, so CI's result is the one that counts.) |

## Against the acceptance criteria

1. Each card shows its picked photo, people recognisable: PASS. With the words hidden, both couples and the three makers read clearly at every size (see note 2).
2. Heading and button inside the card, no overlap, four sizes: PASS (probe, both engines).
3. 4.5:1 against the 95th-percentile pixel: PASS, lowest 6.21:1.
4. For players phone shows today's feed with Kite visible and clear of every button: PASS. Fresh, Followed, Your turn, maker picture with plus, Like, Save, Repost, Share, •••, friends' faces, the new bar; Kite's name tag and character sit in open sky left of the column. Alt text matches.
5. No new colour, gradient or see-through surface: PASS (look and glass tests, diff).
6. No two controls overlap anywhere /about is scrolled, three phone sizes: PASS in WebKit and Chromium; the journey fails without the fix.

CRUD: the change adds nothing a person makes. `sections.ts` is updated as the landing-page rule asks.

## Notes (not blocking)

1. UNIT: `src/routes/about/+page.svelte`, the corner button. VERDICT: note. REASON: on phones it slides out and back several times on the way down the page. EVIDENCE: walking /about in 24px steps with reduced motion, it changed state 11 times at 320 by 568, 9 at 375 by 667, 5 at 667 by 375 and once at 1280 by 720, in both engines. EXPECTED: this is the owner's no-overlap rule working; whether the coming and going feels busy is the owner's call on their walk. FIX: none here.
2. UNIT: `src/lib/look.css`, `.about .closing .card`. VERDICT: note. REASON: on phones the cards are a short strip (117 to 147px tall), so the heading and the button sit over the faces. EVIDENCE: card shots at 320 by 568 and 375 by 667. EXPECTED: people still show around and behind the words. If the owner wants the photos to carry more, a taller card or an `object-position` on phones would do it. FIX: none here.
3. UNIT: `tests/browser/controls-overlap.test.ts:249` "signed in, with a friend's face on a clip, no two buttons overlap, before launch and after" [phone]. VERDICT: note, outside this change. REASON: failed once with "page.goto: WebKit encountered an internal error" navigating to `/followed`, passed when re-run alone. EVIDENCE: this reviewer's local run, WebKit through the Playwright 1.63.0 docker run-server, at `bb9015d`. This PR does not touch `/followed`. EXPECTED: logged under "Flaky tests" in `progress.md` by the coordinator. FIX: none here.
