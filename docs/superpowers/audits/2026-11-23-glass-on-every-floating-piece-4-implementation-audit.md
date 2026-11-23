# Glass on every floating piece: re-review 4 (lane 2)

- Pull request: #370, head `4bc634b510cfd64cfed2d0afd554dbed8a713702` (main `d9f5fde5` merged in).
- Prior review: FAIL at `c630ce9` (re-review 3), one red: phone (WebKit) journeys about 1.7 times slower than main in
  CI, and `adults-only.test.ts:289` [phone] timing out at 30 seconds.
- Reviewer: fresh session, Opus 5.5, medium. Written 2026-11-23 19:37 UTC.

**Verdict: PASS.** The phone journeys are now about 1.1 to 1.2 times main's time in WebKit, none is near its time
budget, every CI piece passed at this head, and the look still matches what the owner approved at `f1f27481`.

## What changed since c630ce9

Builder's own commits (`git diff a82185d 4bc634b -- src`), three files, nothing in tests:

- `src/lib/look.css`: `--glass-edge` keeps its six colours but drops the blur (2px hard insets, fringe alphas 0.4
  sides / 0.22 top and bottom, down from blurred 3px at 0.5 / 0.3); `--glass-ink` is three layers, not five;
  `--glass-icon` is two drop-shadows, not three.
- `src/features/feed/Bar.svelte`, `src/features/feed/Feed.svelte`: the icons that carry `--glass-icon` get
  `will-change: transform`, so their shadow is drawn on its own layer.

The rest of `c630ce9..4bc634b` is main's own work from the `d9f5fde` merge. No time budget changed: the only
`setTimeout` the pull request adds is `glass.test.ts`'s 240-second `beforeAll`, which makes its live game.

## Prior red R1: fixed

**WebKit here, one worker** (Playwright 1.63 docker image, Safari's engine as the `phone` profile; main `d9f5fde5` vs
this head, each with its own fresh Postgres 16 database, run one after the other, twice):

| | main `d9f5fde` | branch `4bc634b` | ratio |
|---|---|---|---|
| Round 1, the 30 journeys both share (adults-only, feed, bar) | 56.5s | 69.5s | 1.23 |
| Round 2, same | 58.5s | 70.1s | 1.20 |
| adults-only.test.ts:289 [phone] | 11.0s, 12.2s | 14.0s, 13.4s | about 1.15 |

All passed: 31 on main, 30 on the branch (the branch replaces `feed.test.ts`'s band sum with `glass.test.ts`, as in
earlier rounds). These match the builder's own claim (1.17 times; adults-only:289 about 13s).

**CI at this head** (run 45244749781, all six browser pieces green, quick draft run), against main `d9f5fde`'s push
run 45231179689, per journey, phone only:

- The 546 phone journeys both runs share: 1666s on main, 1854s here, 1.11 times.
- `adults-only.test.ts:289` [phone]: 18.2s here (30s budget, 61%); main's own CI has run it at 18.6s and 19.5s.
- The slowest phone journeys here all have their own larger budgets: `edit-page` "a maker makes her page..." 46.0s
  (main 42.7s; budget 180s), `test-play` "nobody but the maker..." 22.7s (main 12.4s; budget 120s),
  `make-game-crud` 19.9s (budget 120s). No default-budget phone journey goes past about 62% of its 30 seconds.
- A few short journeys are 1.8 to 2.3 times main (`about.test.ts:36` 15.1s vs 6.5s; three `connect-github` ones
  about 6s vs 3.5s). These are the first journeys each worker ran in the piece (start-up while the runner is busy) and
  sit far under their budgets; see N1.

1.1 to 1.2 times main's time is acceptable for CI: the budgets were set with room for a busy runner, and nothing is
near one.

## The look

- **Same as approved.** Screens over a striped and a plain white clip, phone (WebKit), tablet and computer, with this
  head's tokens and with the approved `f1f27481` tokens put back by a style tag on the same build. Side by side the
  bar, Share, sound, hints and band read the same: the same clear frosted glass, the same warm/cool fringe on the
  edges, the same dark halo behind the words and pictures. The edge is a touch crisper (no blur) and the fringe a
  touch thinner; at phone size it is hard to tell which is which without the labels. Nothing in the owner's notes
  (fringe turned down a bit, floating Back/Next pill, coloured glass buttons) is undone.
- **White-clip readability:** `glass.test.ts` passed on phone (WebKit), tablet and computer here, and in CI at this
  head: every word and picture on the glass stands off a white clip by 4.5 to 1 or more and is still chalk.

## Checks run here

- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings. `pnpm test`: 149 files, 2164 passed.
- Browser: adults-only, feed and bar on phone (WebKit), two rounds, all passed; `glass.test.ts` on all three
  profiles, passed.
- Not run here: the full browser suite (CI ran it at this head, green).

## Findings

None red.

## Notes (not blocking)

- N1. The 1.8 to 2.3 times outliers in CI are worker start-up journeys (`about.test.ts:36`, `connect-github` first
  tests); one CI run cannot separate that from the glass. If they climb toward a budget on later runs, measure them
  alone.
- N2. `main` is now at `b99b7ce` (#368, #373: deploy workflow and its tests), past this branch's `d9f5fde`. Neither
  touches the glass files. One more main merge and a re-point of this PASS before the merge, as the kit says.
- N3. CI at this head is the quick draft run; the full run starts when the pull request is marked ready.
