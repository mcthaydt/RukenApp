---
name: visual-check
description: Use when a change touches screens, layout, copy that people read, or anything a person looks at.
---

# Visual check

This runs on its own whenever a change touches what people look at: the diff touches screen files or copy, or a screenshot moved. A program can tell, so nobody has to ask first. A pull request that touches what people see is not green until this check is done and any fix it found is made. Share early working screens and meaningful visual changes under "Owner visibility and early steering", before extending the design across the product. Label unfinished work and known defects. The owner still gives final acceptance once, as part of the finished result.

A small change (a copy fix, one screen) gets step 1 only, and the session that made it looks, fixes what it finds and looks again. No findings means no fix round. For a set of screens or a slice, fresh review sessions find the problems and the session that built the screens fixes them, with everything in one pull request. A slice, the first one included, is never a small change: fresh sessions run every step, even when it has one screen.

## Shoot what the change touches

Screenshots, walks and reviews cover only the screens a change touches, at the sizes it affects, never every screen at every size. A change to one screen is shot on that screen. A layout change for one size is shot at that size. Copy and fonts are shot at the smallest size, where words wrap first, in each language they change. A shared style, token or component is shot on every screen it reaches, at the sizes of the device matrix in Settings. Where a program can tell from the changed files which screens and sizes a change reaches, it picks them (the repo's `this-repo` skill names it), and a person adds a screen or a size only with a reason in the pull request. A screen or size the change does not touch is not shot again. Every step below, and every walk and review that takes screenshots, runs on this set.

## Before the build: a layout sketch

A brief or spec that adds or changes a screen carries a layout sketch of it: an ASCII or simple box diagram in the spec, or on the short path in the pull request description, that shows what goes where, meaning the main action, the panels and the way back. Where the smallest and largest devices in the matrix in Settings lay the screen out differently, it sketches both. It takes minutes. No pixel designs, no drawing tools and no round of approving the look before the build: the sketch catches a wrong layout early, and the steps below settle the look after the build. Steps 1 to 3 check the built screens against the sketch's layout; a difference is a defect unless the pull request names it with a reason. A named difference also goes into the next update to the owner, with pictures of the sketch and the built screen, as "Expose decisions" in `owner-updates` asks; it is not a new approval gate.

## Before the next slice

Do not move to the next slice without a design review loop on the screens completed during that slice: step 1 beside the slice-end walk (step 2), then the fixes, then step 3, on the screens and sizes the slice changed (see "Shoot what the change touches"). The loop runs in the rounds set in Settings, every one of them. A round shoots the screens, a fresh session checks them, and the session that built them fixes what it found; a round with no findings has no fixes. Every check looks at every screenshot one by one, never a sample, on the model Settings names for that round. The first round is step 1 and the fixes for both it and the walk; later rounds are step 3 on the screens again. The last round before the owner's first look ends with step 4, once per slice. After those rounds, the screens page goes to the owner; the next round fixes the owner's notes along with its own findings, and the screens page goes to the owner again. Screens the owner has already approved are skipped.

## Screens page

The coordinator shows the screens page twice at the end of every slice: after the design review rounds before the owner's first look, and again after the round on the owner's notes, before the owner's walk. Each time it shows all of the slice's screens in one organized artifact: grouped by flow, in the order a person meets them, each screen at each size it was shot at (see "Shoot what the change touches"), labeled with its name and the commit it shows. Screens the owner already approved are included and marked as approved. Share it as one link, not as screenshots scattered across messages.

## Skip what is already approved

- Each step looks only at screens the owner has not approved yet. The coordinator records each approval under "Approved screens" in `docs/superpowers/history.md`. A screen's approval ends when anything that affects it changes: its own files, shared styles, shared components or behavior.
- The full review runs once per set of screens. Later rounds check only the screens whose approval ended.

## Reviews in batches

When a review covers many screens or scene captures, start it in batches within the session limit in Settings, each with a fresh reviewer that reads the same named commit and still looks at every screenshot in its batch one by one; the batches together are that round's one check. Each batch's findings go to the builder by message as it finishes; the builder may start on them but pushes only after the round's last batch reports, and no batch commits its audit file before then. Tell reviewers to measure what can be measured (contrast, how much shows through a panel, sizes and positions) from the pixels, and to judge by eye only what cannot be measured. The coordinator starts the batches. This adds to the steps below and to any scene skill, and replaces nothing in them.

## The steps

Steps 1 to 3 judge the screens against the brief's acceptance criteria. A gap against one is a defect; an idea that would make it better is a note. Step 4 is the one exception: the gap it names is fixed even when no criterion names it.

1. **Words-and-design check:** one check, at the sizes the change affects. Could a drunk grandma understand every word? In practice: every label and message is plain words with no jargon, each screen has one main action that is visible without scrolling, and buttons are big enough to hit with a thumb. Then layout and polish.
2. **End-to-end walk:** the slice-end walk (see `review`), run once and read here, never walked again. A drunk grandma must always see the next step and a way back: no screen is a dead end, and every error says what to do next.
3. **Last look:** in each round after the first, by a fresh session, on the screens and sizes the fixes touched, after the fixes have landed. A defect it finds returns to bounded fixing within the tries in Settings, and the look runs again on those screens only.

4. **Blind judge:** one round per slice, at the end of the last round before the owner's first look, after step 3 passes. A fresh session (the preparer) picks a polished commercial product of the same kind and takes public screenshots of it (its site, store page or docs), with no purchase or sign-up. It pairs each with our screen of the same kind, at the closest size, at the sizes that were shot, and leaves out a size with no fair match. It covers product names and logos, labels the two sets A and B in a random order, and keeps which is which out of the judge's brief. A fresh session says which set looks amateur and names the single biggest gap for each set, where it falls short of the other, or says it cannot tell them apart, and then there is no fix. The preparer, who holds the key, takes the gap named for ours. That gap becomes one fix brief, within the slice's scope and the tries in Settings; a gap that needs a product choice, a new dependency or spend goes to the owner as a decision card with a recommendation instead. Step 3 then runs again on the screens the fix changed. The blind judge does not run again, and the coordinator records its pick in `docs/superpowers/progress.md`.

The order is initial reviews, then the fixes, then the final look, then once per slice the blind judge. Steps 1 and 2 do not need each other, so they run side by side; step 3 waits for the fixes.
