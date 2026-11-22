# Join and help bolder pages: lane 2 implementation audit 4 (re-check)

- Pull request: #348, branch `claude/project-thread-peczhs`.
- Commit examined: `f41311db` (audit 3's `c5b3b0fb` plus `7be92999`, which is formatting only, and `f41311db`, which changes the ring's selector). Main: `eb655acb`.
- Reviewer: the session that wrote audits 1 to 3, Opus 5.5, medium. Written 2026-11-22 21:02 UTC.
- Verdict: **PASS**, with 1 note.

## R1, the phone's plan-row ring: fixed

- `look.css` changes one selector: `.card.bold .plan input:focus ~ .price::before`, where it was `:focus-visible`. The comment records the cause the builder measured: WebKit takes `:focus-visible` off a radio button that an arrow key moves to, but keeps `:focus`.
- CI run 45068848551 at f41311db: shard 4 [phone] `join-and-help-look.test.ts:95`, "the plans can be chosen with the keyboard alone, and the row shows the focus", passed. So did `:320`, "a guide reached with the keyboard rings its whole tile", which is the tile ring on the phone that audit 3 asked to see run.

## R2, formatting: fixed

`7be92999` wraps line 327. `prettier --check` is clean locally, and CI `verify (quick, draft)` succeeded.

## CI and local runs

- CI run 45068848551 (draft quick run): verify, postgres, the 6 browser shards and gate all succeeded. commit-authors and pr-rules-run also succeeded.
- Local, f41311db, tablet + computer: `join-and-help-look.test.ts` and `join.test.ts`, 62 pass.

## Does an `input:focus` ring on a click break an owner rule?

No. In Chromium, clicking a plan row focuses its radio button, so the chosen row gets the 3px ink ring 3px outside its border (a temporary test showed `outlineStyle: solid` after a click on tablet and computer). A screenshot shows it as a double edge round the chosen ink row. No owner rule covers focus rings. The rules cover underlines, icon-only buttons, frosted glass, "Loading" text, page titles and `<style>` blocks, and this ring touches none of them. It adds emphasis to the row already chosen and hides nothing. On a touch phone, a tap on a radio button in WebKit usually doesn't focus it.

- N1 (note): the owner's approved screens were shot without focus, so with a mouse they will now see the ring after a click. If the owner dislikes it, the fix is to limit the ring to WebKit's case. No change asked here.
