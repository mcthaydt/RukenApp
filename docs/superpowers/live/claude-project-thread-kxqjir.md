# Live state: claude/project-thread-kxqjir

- Current task: Custom share sheet (owner: "our share uses native and not a custom share"). Lane 2, short path, Opus 5.5 medium.
- Last commit: (this commit) sheet built, journeys written; at 2026-11-24 04:41 UTC
- Next step: run the share journeys on phone, tablet and computer; shoot the sheet; open the draft PR.
- Open decisions: none. Targets picked as sensible defaults (Copy link, Text, WhatsApp, Email, X, Facebook, and More = the phone's own share sheet where there is one).

## Acceptance criteria

1. Pressing Share on a feed clip or on a game's page opens Ruken's own sheet (a glass panel over a dimmed screen), never the phone's share sheet first.
2. The sheet shows "Share", the game's name, the game's link as text, and one main blue button "Copy link".
3. Copy link puts the game's page address on the clipboard and says "Link copied." in the sheet. Where the clipboard refuses, the sheet says how to copy the link by hand, and the link text stays there to copy.
4. The sheet offers Text, WhatsApp, Email, X and Facebook, each a link that opens that app with the game's address in it.
5. "More" opens the phone's own share sheet with the game's address, and shows only where the browser has one. Closing the phone's sheet says nothing.
6. Close (the cross), Escape and a press on the dimmed screen close the sheet and put focus back on Share.
7. The sheet fits the window with no page scroll on small phone, tablet and computer, rising from the bottom on an upright phone; every press target is at least 44px; it passes the glass test.
8. Everything works with the keyboard alone; focus is visible.
