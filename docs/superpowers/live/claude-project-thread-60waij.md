# Live state: unit D, the feed screen

- Task: build unit D of docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md (D1 to D14), lane 2, branch claude/project-thread-60waij, started from main c094e27.
- Status: PARKED at 03:12 UTC on the owner's word ("park slice 3 until we confirm slice 2 is perfect"). Pushed as a draft; nothing merges until the coordinator says resume.
- Last commit: see `git log -1` on the branch.
- Done: Feed.svelte, Bar.svelte, current.ts, share.ts, routes, layout bar, game page back link, architecture rule (D14 test), journeys feed/feed-controls/bar, old home tests replaced. On a local run (Chromium: phone, computer) feed.test.ts and bar.test.ts passed; feed-controls had the preload fix (Feed.svelte `warm`) and the Tab-order rewrite made after its last run, so those two are not re-run yet.
- Next step on resume: rebuild, rerun feed, feed-controls, bar, look, look-layout and make-walk journeys; empty-feed component test (svelte/server render); update `.claude/skills/verify/SKILL.md` main-screen text and driver script (D14); lint, typecheck, unit tests; PR criteria; CI; then tell the coordinator.
- Open decisions: none. Deviation to report: MakerPage is re-exported from `pages.screens.ts`, not `pages.browser.ts`, because a route matcher imports `pages.browser.ts` and Node cannot load a .svelte file.
