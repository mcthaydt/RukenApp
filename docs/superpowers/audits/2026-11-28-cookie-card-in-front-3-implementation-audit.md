# Cookie card in front, implementation audit, round 3

Pull request #467, lane 2. Reviewed head cc8dd65b54be713e76ec9225e88bd591bc6b132d (f6526c5 with current main 2a88be3 merged in; the PR's own diff against main is unchanged, 11 files). Fresh session, Opus 5.5, medium. Written 2026-11-28 15:03 UTC.

Verdict: **PASS**, no red.

## Round 2's red

- R1 (wheel on mobile WebKit): fixed. `cookie-what-we-keep.test.ts` scrolls `document.body` by script when `isMobile`, wheel elsewhere, and still asserts "Read the terms" is in view. CI run 46157202565: both journeys pass on phone (WebKit, iPhone SE), tablet and computer.
- Round 2's note (card over a /help button with no dim before scripts): fixed. The dialog is no longer rendered with `open`; it opens only through `showModal()` in the effect. The new `cookie-consent.test.ts:338` journey (scripts off: hidden on / and /help; scripts on: `:modal`) passes on phone, tablet and computer.

## Checks run

- Local, at f6526c5: `pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` 170 files, 2453 passed.
- CI run 46157202565 on cc8dd65 (draft quick run): verify, postgres, six browser shards and gate all success, no retries. In it, on phone (WebKit) and tablet: `controls-overlap` signed out, unanswered (320x568, 375x667, 667x375, before and after launch), signed in, teen, maker, about; `sideways-phone` card in front and step screens for three iPhones; `fits-the-screen:401` (card waits under Turn upright). The computer project skips the phone-size files by design.
- The full run happens when the PR is marked ready; the merge gate reads it.

## Scripts off or slow (no dead end)

Read the code: with scripts off the card is never drawn, and every page still reads and works. The cookie choice is still reachable: every gated page (sign in, sign up, join, play, wishlist, follow, account) redirects to /cookies (`gate.ts`), whose I agree is a plain form, and /privacy links "the cookies page". Before scripts load, a press on a gated link takes the same server route. Like, Save and Repost ask in place and need scripts in any case. So there is no dead end.

## Notes (not blocking)

- N1. Criterion 3 (Tab order, arrows do not move the feed, Escape is Not now) has no browser journey; round 2 checked it by hand in Chromium, and the code behind it is unchanged in this round. A journey for it would make it a check.
- N2. Carried from round 2: in Chrome a close request with no recent activation (or Android Back) can close the card without calling Not now; it reopens on the next press that needs the yes. Not a dead end.
- N3. Scripts-off browsers now see no cookie question until a gated press; acceptable under the owner's choice (the card only with its dim).

## Flag: #462

#462 (head b99d2ca) conflicts with this head in `src/routes/+layout.svelte`, `tests/browser/controls-overlap.test.ts`, `tests/browser/fits-the-screen.test.ts` and `progress.md`. Whichever merges second keeps `!ASKED_NEXT` and adds `/make` to `NO_CARD`, as round 2 said. Flagged, not failed.
