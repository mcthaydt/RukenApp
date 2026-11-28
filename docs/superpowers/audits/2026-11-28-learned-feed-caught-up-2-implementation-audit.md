# Learned feed caught-up line: implementation audit 2

PR #440, examined at bb299c399a6e050a2a20ef57757048a373f23cb6 (bb299c3). Lane 2. Reviewer: Opus 5.5, medium. Fresh session.
Prior audit: 2026-11-28-learned-feed-caught-up-1-implementation-audit.md, e5fb768 FAIL, 2 red.

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Verdict: PASS (0 red, 4 notes)

## What ran (at bb299c3)

- `pnpm test`: 169 files, 2443 tests passed.
- `pnpm lint`: exit 0. `pnpm typecheck`: 0 errors, 0 warnings.
- Mutation: `src/features/feed/service.ts` put back to e5fb768 with the new test kept: the new test
  "caught up right after a page's last clip..." fails (1 failed, 36 passed). So the test fails by itself without the fix.
- PR CI at bb299c3: all 12 checks green (6 browser shards, postgres, verify, gate, commit-authors, pr-rules-run).
- Not run: a fresh shoot of the screens. Feed.svelte is unchanged since e5fb768 (diff e5fb768..bb299c3 touches only
  service.ts and ranker.test.ts), so audit 1's layout findings stand.

## Red 1 (caught-up point dropped at a page's end): FIXED

- RukenPrivate `worker/src/feed/feed.ts` endRound sets `caughtUpAt = items.length` only in round 0, and the page
  usually ends right where round 0 ends, so the point sits past the last item. service.ts now finds no shown clip at or
  after the point, writes the next address with `pc.` instead of `p.`, and on that next page puts the line on the first
  shown clip (`from = 0`). The ranker is handed the address with the prefix cut off (test asserts `after` is "one" and "two").
- Carries further when the next page has no shown clip either (carryOn stays true), and stops after it lands (third page
  in the test has no line). Covered both for "point past the end" and "point on a game no longer live".
- Prefix parsing: `pc.` is tested before `p.`; a plain `p.` address never starts with `pc.` (second char is "."), so no
  ambiguity.

## Edge cases checked

- `pc.` reaching the crowd/open path: when no private ranker is bound, the play read failed, or the private ranker is
  slow/throws, `cursor.made === "private"` hands the open ranker `null` (a fresh first page), and `carried` needs
  `prefix === PRIVATE_PREFIX`, so no line is forced onto an open page and no `pc.` is written by the open path. Matches
  how a `p.` address already behaves.
- Crowd viewer with the private ranker bound: same carrying as for a full viewer; consistent with page 1's own line.
- Tampering: anyone can write `pc.` in front of a private address. The only effect is the line on that page's first clip
  for that person. The ranker still validates its own cursor (bad cursor still gives 400). No data or privacy effect.
- Repeats: Feed.svelte appends each page's `caughtUp` key; keys carry the round (`1~slug`), so a carried line marks one
  clip and is not shown again on later pages. Round 0 ends once per frozen order, so the ranker names one point per order.

## Red 2 (667x375 bar column over Like/Save/Repost): PENDING ON MAIN MERGE, not a finding against this diff

On main today; fixed by #435 (not merged at this audit). #440 must merge main after #435 lands and re-run the
controls-overlap journey at 320x568, 375x667 and 667x375 before it merges (owner rule: any overlap blocks). A merge of
main that leaves this PR's own files unchanged carries this PASS; a conflict in its own files needs a fresh review.

## Privacy gating (rechecked)

- `askingOf` (feed-public.ts): crowd unless `learned` is on, the person is signed in and the browser's consent cookie
  says yes (`hasConsent`, current CONSENT_VERSION). Only then is the account read.
- `taste.learningOf`: "locked" unless `isAdultOn(adultOn, clock)`, which compares the 18th birthday with today's Chicago
  date (`todayInChicago`); "on" only with `feedPersonal`. A read that throws is the crowd. `parentSaidYes` is false, so a
  teen is the crowd whatever `teenPersonal` says. Both the first page (+page.server.ts) and later pages (/api/feed) pass
  the cookies.

## Notes (not blocking, follow-ups)

1. A `pc.` page that falls back to the open order loses the line (fresh open page). Harmless; a rare outage edge.
2. If every game of the frozen order goes while a `pc.` address is out, the ranker restarts from a fresh order; the line
   lands on that fresh page's first clip, and the new round 0 can give a second line later.
3. A tampered `pc.` address can show the line early for the person who tampered. Cosmetic only.
4. The FeedPage doc comment in service.ts now runs past the file's usual line width in one sentence; prettier passes, so
   style only.
