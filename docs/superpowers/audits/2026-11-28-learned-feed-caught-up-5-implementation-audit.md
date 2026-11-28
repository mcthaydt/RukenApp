# Learned feed "caught up": review 5 (#440's journey fix)

- Pull request: #440. Head examined: `01d2bc73ec0067f5582ca38c1c03d8c69d248594`. Scope: `git diff e954a10 01d2bc7` (2 files: `tests/browser/feed-caught-up.test.ts`, `docs/superpowers/progress.md`).
- Lane: 2 (a test change in a lane 2 pull request). Fresh session, Opus 5.5, medium.
- Verdict: **PASS**, with one note on the flake record (below). No red findings.

## What changed

The journey "caught up from the first clip, the line and the first open's tips stand apart" used to resize one window and `goto("/")` again at each size. It now opens each size in a new window of the same context (`asInstalled`, an init script that forgets `rk_seen_hints` before the page reads it, the page route moved to the context), and checks that the first clip is `data-current` before it measures. No assertion was removed or loosened: every check from `e954a10` is still there, and one was added.

## What ran (local, Chromium 1243 from `/opt/pw-browsers`, Postgres 16, `wrangler dev --local`, WebKit warm-up left out because this container has no WebKit; tablet is Chromium in `playwright.config.ts`)

| Run | Commit / change | Result |
|---|---|---|
| New journey, tablet + computer, `--repeat-each=3` | `01d2bc7` | 6 of 6 passed |
| New journey with both `.caughtup + .hints` rules taken out of `Feed.svelte` | `01d2bc7` minus the tips fix | 2 of 2 failed: "the tips cover the line at 320×568" (tablet and computer) |
| Old journey, tablet, `--repeat-each=8 --workers=4` | `e954a10`'s test | 4 of 8 failed, "320×568 … viewport ratio 0" (the CI failure, reproduced) |
| Old journey, probe after the reload | `e954a10`'s test | 4 of 8 failed; in each, the reloaded feed at 320×568 sat at clip 1, 2 or 3 (`scrollTop` 568, 1136, 1704) |
| Old journey, probe before the reload | `e954a10`'s test | 2 of 8 failed; the window read clip 0 at `scrollTop` 0 before every `goto` |
| `eslint` on the journey | `01d2bc7` | clean |

CI at `01d2bc7` (run 46110389918) when this was written: verify, postgres, commit-authors and browser shards 1 to 4 green; shards 5 and 6 still running; `pr-rules` red only because no review named this head yet.

## Is the fix hiding a product bug?

What a real person does, tried on the tablet profile under 4 workers, 6 times each, every one landing on clip 0 at `scrollTop` 0:

- open the feed at 320×568 and reload it; open it and `goto("/")` again;
- open it at 810×1080, resize to 320×568, then open it again (with and without the first page told "caught up at the first clip", and with and without forgetting `rk_seen_hints` first);
- open it at 810×1080 and resize to 320×568, 1080×810 or 375×667 with no reload, read 30 times straight after the resize: clip 0 at 0 every time.

So 54 tries of the real-person versions never moved off the first clip. The jump came only in the old journey's own sequence. In that sequence, the probe read the old window as being on clip 0 at `scrollTop` 0 right before every `goto` (all 16 reads at the small sizes), so the reloaded page did not come back where it was left: it landed one to three clips down. SvelteKit's snapshot is not the reason either: the snapshot it kept names clip 0's key, and `returnTo` does nothing for index 0. The real cause was not found in three tries. I stopped there, as the tries rule says.

The new check does not hide it. If a first open ever lands past the first clip, `the feed opens on its first clip` fails with its size named, and the line and tips checks still run after it.

## Note (not blocking)

UNIT: `docs/superpowers/progress.md`, the new "Flaky tests" entry for `feed-caught-up.test.ts:173`.
VERDICT: note.
REQUIREMENT: Report honestly. A flake record says what was seen and whether the cause was found.
REASON: The entry gives "a reload may come back where it was left" as the likely cause, and says the journey passed in 6 of 6 local runs. This review's probes show the window was on clip 0 just before the reload and landed on clip 1 to 3 after it, so it did not come back where it was left. The old journey also failed 10 of 24 locally under 4 workers.
EVIDENCE: the runs above (old journey on tablet, `--workers=4`).
EXPECTED: the entry says the cause was not found: in the old sequence, the reloaded feed sometimes opened 1 to 3 clips down, though it was on the first clip before the reload. It was not seen when a person reloads, resizes or opens again (54 tries). It also names the local reproduction (the old journey failed 10 of 24 locally under 4 workers).
FIX: reword that one entry in `docs/superpowers/progress.md`, and touch nothing else. A `progress.md`-only commit keeps this PASS.

## Follow-up (outside this change, not fixed here)

- The old sequence (one window: set the size, forget `rk_seen_hints`, `goto("/")` again) can open the feed one to three clips down on Chromium under load, and the cause is unknown. Nothing a person did reproduced it. If a person reports "it opened on the wrong clip", this review's probe sequence is the place to start.
