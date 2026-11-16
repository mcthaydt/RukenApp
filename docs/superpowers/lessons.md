# Lessons

Lessons that no test, screen check or code fix can hold, one line each, with the date and the pull request it came from (see "Lessons" in CLAUDE.md). A lesson becomes a test first; only what a test cannot hold is written here. The coordinator reads this file before writing a brief and removes a line once a test covers it.

- A refusal that can happen on a press is checked before any "are you sure?" question on that press, so a person is never asked to confirm something that is then refused (harsh look HL4). (2026-11-16, #138)
- A refusal belongs right above the thing it is about, and its words name that thing; a part's heading is not enough when a part holds two questions (HL1). (2026-11-16, #138)
- Two controls that do different jobs sit with their own explaining line, never with another control between them (HL2). (2026-11-16, #138)
- A refusal inside a block of someone else's words wears the look's "needs fixing" edge, so it is never read as part of those words (HL3). (2026-11-16, #138)
- Scrolling a page to a place waits for the page's entrance animations to finish, because a moving line is measured where it is, not where it will rest (HL3). (2026-11-16, #138)
- A bar with more links than its narrowest window can hold shrinks its links at that size, so it never wraps to a second line (HL5). (2026-11-16, #138)
- A dot between facts is written with the words after it, so a line never starts or ends with one (HL6). (2026-11-16, #138)
- A height that must fit the window counts every bar and gap above the thing, not only the thing's own margin (HL7). (2026-11-16, #138)
- A button under a picture has the same step above it as the picture has above itself, so it is not read as the picture's caption (HL8). (2026-11-16, #138)
- Two pages of one area share one rule for their bar, so it starts at the same edge as the page under it (HL9). (2026-11-16, #138)
- A page that is drawn outside its area's layout gets what that layout would have given, such as the wordmark, from the page that hides it (HL10). (2026-11-16, #138)
- A link that staff use every day is never the line right above "Delete my account"; the way to delete keeps a clear step (HL11). (2026-11-16, #138)
- Check CI results yourself (`gh run watch` or poll the run's status); never wait for a notice. A session sat an hour on an already-green run. (2026-11-16)
- A new screen starts from the shared pieces of the screens it must look like (here the maker's QuestionScreen and Picks), widened by a small option, never copied; a whole day of review rounds went on staff screens built in a pattern of their own. (2026-11-16, #138)
- A screen whose pattern is new is shown to the Owner as rough shots before any review round, so the wrong pattern is found in minutes and not after the reviews. (2026-11-16, #138)
- Fewest screens first: a form asked one screen at a time starts at the fewest screens that give each screen one job (here three), and splits only where the Owner asks. (2026-11-16, #138)
- Rough shots are taken from a game made through the real screens, not from a test stand-in with no files, so an empty frame is not read as a bug. (2026-11-16, #138)
- A decision that reads, checks and then writes takes the row it judges first (`SELECT ... FOR UPDATE`), and gets a test that fires two decisions at once; a check alone does not stop a second one slipping between the read and the write. (2026-11-16, #138)
- A link whose page `load` does something (here, starting a staff play) turns hover preload off, and a refused form action does not re-run `load`, so the page reloads its own data on a refusal that says the data is stale. (2026-11-16, #138)
