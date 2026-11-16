---
name: visual-check
description: Use when a change touches screens, layout, copy that people read, or anything a person looks at.
---

# Visual check

This runs on its own whenever a change touches what people look at: the diff touches screen files or copy, or a
screenshot moved. A program can tell, so nobody has to ask first. A pull request that touches what people see is not
green until this check is done and any fix it found is made. Share early working screens and meaningful visual
changes under "Owner visibility and early steering", before extending the design across the product. Label unfinished
work and known defects. The owner still gives final acceptance once, as part of the finished result.

A small change (a copy fix, one screen) gets step 1 only, and the session that made it looks, fixes what it finds and
looks again. No findings means no fix round. For a set of screens or a slice, fresh review sessions find the problems
and the session that built the screens fixes them, with everything in one pull request. A slice, the first one
included, is never a small change: fresh sessions run every step, even when it has one screen.

## Before the next slice

Do not move to the next slice without a design review loop on the screens completed during that slice: steps 1 and 2
side by side, then the fixes, then step 3, on each device in the device matrix in Settings. Screens the owner has
already approved are skipped.

## Skip what is already approved

- Each step looks only at screens the owner has not approved yet. The coordinator records each approval under "Approved
  screens" in `docs/superpowers/history.md`. A screen's approval ends when anything that affects it changes: its own
  files, shared styles, shared components or behavior.
- The full review runs once per set of screens. Later rounds check only the screens whose approval ended.

## The steps

Each step judges the screens against the brief's acceptance criteria. A gap against one is a defect; an idea that would
make it better is a note.

1. **Words-and-design check:** one check, on each device in the device matrix in Settings. Could a drunk grandma
   understand every word? In practice: every label and message is plain words with no jargon, each screen has one main
   action that is visible without scrolling, and buttons are big enough to hit with a thumb. Then layout and polish.
2. **End-to-end walk:** every journey, on each device in the matrix. A drunk grandma must always see the next step and a
   way back: no screen is a dead end, and every error says what to do next.
3. **Last look:** one, at the end, by a fresh session, on each device in the matrix, after the fixes have landed. A
   defect it finds returns to bounded fixing within the tries in Settings, and the look runs again on those screens
   only.

The order is initial reviews, then the fixes, then the final look. Steps 1 and 2 do not need each other, so they run
side by side; step 3 waits for the fixes.
