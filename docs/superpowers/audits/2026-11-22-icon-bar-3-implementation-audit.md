# Icon bar: implementation audit, cycle 3 (re-check after merging main)

Pull request #319, lane 2. Commit examined: a71f99e (merge of main c80ab01 into bd8a27b, which passed). This file is committed directly on a71f99e and changes nothing else.

## Verdict: PASS, 0 red

## What was checked

- **The merge.** a71f99e's parents are bd8a27b (the PR, PASS) and c80ab01 (main). With `index` and `@@` lines left out, `git diff bd8a27b a71f99e` equals main's own change `git diff d51c3db c80ab01` in every file except `docs/superpowers/progress.md`.
- **The hand-resolved conflict.** `git diff c80ab01 a71f99e -- docs/superpowers/progress.md` is exactly one added line, the PR's 13:43 UTC owner entry for the icon bar, placed between main's 13:41 and 13:45 UTC entries, so the entries stay in time order and none of main's lines is lost or changed. The file holds no conflict markers.
- **The PR's own diff.** Outside `progress.md`, `git diff c80ab01 a71f99e` equals `git diff d51c3db bd8a27b` (index and hunk lines left out): `Bar.svelte`, `+layout.svelte` (one line), `bar.test.ts`, `feed-controls.test.ts`, the `verify` skill and the two earlier icon-bar audits.
- **Main's changes against the bar.** Main brought the learned-feed spec and audits, the feed panel's `overscroll-behavior: none` in `Feed.svelte`, and `look.css` rules that keep the page from scrolling, bouncing or zooming behind the panel. None of them touches `Bar.svelte`, the layout, or the tokens the bar reads. The bar is fixed to the window at the layout level, so a page that no longer scrolls does not move it; the journeys below confirm it.

## Runs at a71f99e (fresh Postgres 16 database)

- `pnpm lint`: exit 0.
- `pnpm typecheck`: 0 errors.
- `pnpm test`: 1969 of 1969 passed.
- `bar.test.ts`, `feed-controls.test.ts`, `feed.test.ts` on tablet and computer: 62 passed, no retries.
- Not run: the phone profile. It uses WebKit, which this container does not have (`browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh`); its three attempts failed at launch in 0 ms, before any page loaded. CI runs the phone profile.

## Notes (not findings)

- The bar is solid, not frosted; the owner asked for the frosted bar after this PR, in the glass thread.

CI on the merged head must pass, including the full browser run, before merge.
