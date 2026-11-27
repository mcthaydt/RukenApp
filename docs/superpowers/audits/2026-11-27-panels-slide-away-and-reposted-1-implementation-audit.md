# Implementation audit 1: panels slide away, and Reposted (PR #425)

- Reviewed head: `8982b372e972bfc0d2dfaf07b525b8269c2edb61` (8982b37), base `main` 84a3f98.
- Reviewer: fresh session, Opus 5.5, medium. Lane 2 (`src/lib/look.css`, new `src/lib/sheet.ts`).
- Written 2026-11-27 14:55 UTC.

**Verdict: FAIL, 1 red.** Everything the owner asked for is there and works on an ordinary frame rate, in WebKit too. One red: the safety timer that closes a panel "in case the slide never ends" starts before the slide does, so whenever the first frame after a press is late, the panel is cut off part way down and vanishes. That is the owner's complaint ("no transition out") coming back on a busy phone.

## What ran

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 2,360 of 2,360 passed |
| Browser journeys `sheets-slide`, `feed-marks`, `report-a-game`, `feed-controls`, all three profiles (phone = WebKit, iPhone SE; tablet and computer = Chromium), Playwright 1.63 docker image, site on this container per `verify` | 165 of 165 passed |
| Reviewer's probe: Share (Escape, dimmed screen), ••• (Cancel, double Escape, reopen), Report (cross): focus goes back to the opener each time, double Escape leaves no `closing` class stuck, the panel opens again normally | passed on phone (WebKit), tablet, computer |
| Reviewer's probe: Repost at 320 × 568 | passed on all three: "Reposted" inside the window (x 244 to 308), disc 48 × 48, button 64 × 70, page height = window height, scrollY 0; taking it back shows "Repost" and removes the check |
| Reviewer's probe: a frame 200 ms late just after Cancel | **failed 9 of 9** (3 per profile). See red 1 |

CI on this head was not read by this review (draft quick run). The builder ran no WebKit. This review did, and the PR's own journeys pass in it.

## Acceptance criteria against the PR body

- ••• panel slides away for Cancel, Escape, dimmed screen, gamepad B, a choice: met (journey passes in WebKit too). Gamepad B checked against #409's `pad-focus.ts` `back()`: it dispatches a cancelable `cancel` and closes only if not prevented, which is what the journey simulates.
- Report slides in and away for the cross, Escape, B, focus back on Report: met. Report has no dimmed-screen close on `main` either, so none is expected here.
- Share still slides: met.
- Reduced motion: met (`slideAway` closes at once; no animation names recorded).
- Reposted with check, after reload, gone after undo (both undo paths): met, CRUD on the repost covered in `feed-marks.test.ts` (create, read after reload, delete from the clip and from Your reposts; a repost has nothing to update).
- Fits at 320: met (measured above, screenshot below).
- Swipe down: no panel has one on `main`; the PR says so. Not a gap.

## Red

**1. The slide away is cut short when the first frame is late.**

- UNIT: `src/lib/sheet.ts`, `slideAway`.
- VERDICT: red.
- REQUIREMENT: the owner's ask (2026-11-27 13:33 UTC) that the panel has a transition out; the brief's "every way out slides away".
- REASON: the 400 ms fallback `setTimeout(finish, LONGEST_SLIDE_MS)` is armed when `closing` is added, but the 260 ms slide only starts on the next frame. If that frame comes more than 140 ms late, the timer closes the dialog before the slide ends; the animation is cancelled with the panel still partly on screen.
- EVIDENCE: probe `audits/2026-11-27-panels-slide-away-1-probe-late-frame.test.ts.txt` (project files) stalls the page for 200 ms right after `closing` is added, then presses Cancel on the ••• panel. 9 of 9 runs closed from the timer before the slide ended. Phone (WebKit): `start:sheet-down@201 … close()@401`, so cut 200 ms into 260 ms, about a third still visible (cubic-bezier(0.4,0,1,1) at 0.77 time is 68% done). Tablet/computer (Chromium): `start:sheet-out@244–311 … close()@402`, then `animationcancel`, cut 90–160 ms in, most of the panel still visible. Without any stall, on this loaded container, the same thing happened unprompted: phone WebKit runs showed `start:sheet-down@702 … close()@906 … cancel:sheet-down`, and computer Chromium `start:sheet-out@169 … close@413 … cancel:sheet-out@429`. The slide in has no timer, so it always plays in full: the in/out mismatch the owner reported. The project already knows phones stall on a first press (#377).
- EXPECTED: the panel always reaches the end of its slide before it closes, however late the first frame; the safety close only catches a slide that truly never ends (a hidden tab).
- FIX: in `slideAway`, arm the fallback from the slide's own start, not from the press. For example, after adding `closing`, take the panel's own animation (`sheet.getAnimations()` filtered to the element, not `::backdrop`) and close on its `finished`, with the safety timer started on `animationstart` (or kept, but long enough for a slow first frame, such as 1,000 ms counted from `animationstart`). Add a journey like the probe above (stall the first frame 200 ms, expect `animationend` before `close`) to `tests/browser/sheets-slide.test.ts`. Files: `src/lib/sheet.ts`, `tests/browser/sheets-slide.test.ts`.

## Notes (not blocking)

- N1. When Repost turns into "Reposted", the wider word (63–64 px against 48) moves the whole side column about 8 px to the left (Like moved from x 260 to 252 at 320 wide), and the game's name card beside it gets narrower by the same amount (compare the two screens below). It fits and nothing overlaps, but every button and the card shift on the tap. A fixed column width (or the word allowed to overflow its own box centred) would keep the column still. Owner's call whether it matters.
- N2. `Feed.svelte` adds a second `.disc { position: relative; }` block next to the existing `.disc` rule; it could join it.
- N3. While a panel slides away (260 ms) it is still modal and its buttons still take presses (a gamepad A on Copy link mid-slide would copy). Harmless, recorded only.

## Screens

- Reposted at 320 wide, phone WebKit: `audits/2026-11-27-panels-slide-away-1-repost-320-phone.png`. Check sits on the top right of the disc, green glass, word "Reposted" readable, nothing clipped.
- Taken back: `audits/2026-11-27-panels-slide-away-1-repost-undone-320-phone.png`.
