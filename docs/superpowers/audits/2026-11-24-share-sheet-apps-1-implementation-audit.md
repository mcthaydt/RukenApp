# Share sheet apps (Text, WhatsApp, Instagram, Email, X): implementation audit 1

- Pull request: #394 (lane 2, short path). Commit examined: `e0d9d92491ddd9892ad05889ab7753557c4d681a` (on `main` `c6ee45d`, still main's tip).
- Reviewer: fresh session, Opus 5.5, medium effort. Written 2026-11-24 16:01 UTC.
- Verdict: **PASS.** No red. Three notes.

## What ran

- Read the diff: `share.ts` (Facebook out; Instagram after WhatsApp with `href` `https://www.instagram.com/direct/inbox/` and `pasteFirst: true`), `ShareSheet.svelte` (`copy(then)`; an `onclick` on each app link that, for `pasteFirst`, starts the copy and lets the link's own `target="_blank"` open; Instagram icon; Facebook icon gone, X now the `{:else}` branch), `share.test.ts`, the Share journey in `feed-controls.test.ts`, and the `progress.md` row. No other `Facebook` left in `src`.
- `share.test.ts`: 8 passed.
- Cloud container, Node 24, Postgres 16, Playwright 1.63.0, `wrangler dev --local`: `feed-controls.test.ts`, `game-page.test.ts` and the probe, phone, tablet and computer: **150 passed**.
- Probe (not committed, `/mnt/project-files/audits/2026-11-24-share-sheet-apps-1-probe.test.ts.txt`), with the real clipboard (no stand-in) and a real new tab, Instagram's address answered by an empty page:
  - Chromium, headed under Xvfb (tablet and computer), by mouse and by keyboard (Enter): a new tab opens at `https://www.instagram.com/direct/inbox/`, the sheet stays open and says "Link copied. Paste it in Instagram.", and the system clipboard holds the game's address (read back after returning to the tab).
  - WebKit (phone, headless): the new tab opens at the inbox address and the sheet says "Link copied. Paste it in Instagram." (`writeText` resolved inside the press). Reading the clipboard back is refused outside a press, as WebKit does, so the content itself was checked in Chromium only.
  - Clipboard refusing, and clipboard missing (phone, tablet, computer): the tab still opens, and the sheet says "Press and hold the link above to copy it." (touch) or "Select the link above to copy it." (computer), as Copy link does.
  - Buttons: all five apps are 61×82 (106×82 on the phone) with a 48×48 round; screenshot checked: the Instagram icon (rounded square, lens, dot) reads clearly and matches the others' line style.
- PR CI at `e0d9d92` (quick, draft): verify, postgres, pr-rules, commit-authors, browser shards 4, 5, 6 success; shard 2 failed on `feed-controls.test.ts:438` (computer, "Back from a game opened past the first page…", clip `nth(3)` never current after the "more" row came in), shards 1 and 3 cancelled with it. That journey is about the endless feed, untouched by this diff, and passed here on all three devices. Failed jobs re-run: see the end.

## Popups and clipboard on phones

- No popup blocker applies: Instagram opens through the link's own `href` and `target="_blank"` on a real press, not `window.open`, so Safari and Chrome treat it as a normal link.
- The clipboard write starts synchronously inside the press (`onclick` → `copy` → `copyLink` → `navigator.clipboard.writeText` before any `await`), which is what iOS Safari and Android Chrome require; neither prompts for a write made in a press.
- Not run on real devices: an iPhone in Safari and an Android phone in Chrome were not available here. Whether `instagram.com/direct/inbox/` opens the Instagram app (universal link / app link) rather than the website is up to the phone and was not checked.

## Notes (not blocking)

1. The words "Link copied. Paste it in Instagram." show in the sheet the person has just left; they see them only on coming back. Someone landing in Instagram's inbox is not told there to paste. If wanted later: say it before opening (a short pause, or a first press that copies and a second that opens).
2. With the clipboard refused or missing, the person reaches Instagram with nothing copied and must come back to copy by hand (criterion 4 accepts this).
3. `feed-controls.test.ts:438` failed once in CI on this commit and passes here: it belongs under "Flaky tests" in `progress.md` if the re-run passes.

## CI re-run

- Run 45430944406, attempt 2 (failed jobs only): browser shards 1, 2 and 3 success, gate (quick, draft) success at 2026-11-24 16:14 UTC. `feed-controls.test.ts:438` (computer) failed once and passed on the re-run: a flaky test, unrelated to this diff, to record under "Flaky tests".
