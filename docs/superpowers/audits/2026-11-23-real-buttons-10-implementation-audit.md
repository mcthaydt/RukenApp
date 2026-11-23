# Real buttons (#345), round 10 re-check

Head reviewed: b3b969f984523ace27ae125fb8b1674f973375b0 (diff from 8ca99df: look.css +1, real-buttons.test.ts +7, progress.md +3).
Reviewer: fresh lane 2 review, Opus 5.5, medium. Written 2026-11-23 23:16 UTC.

## Verdict

b3b969f PASS.

## Round 9's red: landing footer links bold

- Fix: `font-weight: 400;` added to `.about .sitefoot a` (`src/lib/look.css:4431`), as the round 9 audit asked. The footer's only anchors are the plain `<li><a href>` column links (`src/routes/about/+page.svelte:257`), so the rule restores main's weight and changes nothing else.
- Check: `tests/browser/real-buttons.test.ts:278` asserts every `.about .sitefoot a` has computed weight `400` and that there is at least one.
- The check passes at b3b969f on computer and tablet (2 passed, 23.9s).
- It fails by itself: with the one CSS line removed, the same journey on computer fails (Expected/Received differ), and it passes again with the line restored.
- No other source change in this diff. The progress.md lines are the flaky list, a doc.

## feed-controls:832

Not re-run here (no WebKit). The coordinator reports it passed 3 of 3 alone and within shard 3 on phone via the WebKit docker image, and CI shard 3 at 8ca99df was green. That is consistent with the round 9 reading of a timing race not caused by this PR.
