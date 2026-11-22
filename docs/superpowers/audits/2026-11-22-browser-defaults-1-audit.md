# Audit: what does the browser still draw itself?

Examined: `main` at `b523531` (merge of #325), read in the code and rendered on `localhost` in Chromium at phone (375×667) and computer (1280×720) sizes, on `/`, `/sign-up`, `/sign-in`, `/join` and `/help/get-your-game-on-ruken`. WebKit is not installed in this container, so nothing here was rendered in Safari's engine; the Safari-only items are read from the code. Open pull request #323 was read at its head for what it already covers. Reviewer: Opus 5.5, medium.

Asked by the owner (2026-11-22 15:51 UTC): "can we have a custom video player instead of the built in for whenever we have full screen videos like on the game page, audit for us using anything built in/default from browser, EVERYTHING should be custom". Standing rule (2026-11-22 13:46 UTC): app feel at all times, nothing breaks the illusion of a browser.

## Answer

Six things on `main` are still drawn by the browser where Ruken could draw its own. Ranked by how often a player or maker sees them:

| # | What | Where (evidence) | Seen by | Fix |
| --- | --- | --- | --- | --- |
| 1 | **The browser's video player.** A full-size video plays with the browser's own controls; on an iPhone its full-screen button opens iOS's own player. | `src/routes/g/[game]/+page.svelte:243` (`<video … controls autoplay>` in `dialog.viewer`), `src/routes/make/parts/VideoTile.svelte:71` (same, maker screens), `look.css:1392` ("with the browser's controls") | Every player who opens a game's video; every maker checking their video | A Ruken player: play/pause, a scrub bar, time, sound on/off (clips are silent today, so hidden while a clip has no sound), Close; frosted glass (`--glass-bg`, `--glass-filter`) behind the controls; a spinner while it loads; never the browser's full screen, so it stays inside the page on an iPhone. |
| 2 | **Scrollbars.** Every screen that scrolls, and the feed itself, gets the system's grey scrollbar on a computer (Windows, Linux, and a Mac with a mouse). | `look.css` has no `scrollbar-*` rule; rendered: `scrollbar-width: auto`, `scrollbar-color: auto` on all five screens; feed scroller `src/features/feed/Feed.svelte:314` (`overflow-y: auto`) | Every computer visitor | A thin Ruken scrollbar in the felt colours on reading screens (`scrollbar-width: thin`, `scrollbar-color`), and none on the feed, which is swiped or moved with the keys. |
| 3 | **Drop-down lists.** The country on sign-in and sign-up, and the branch on a game's files, are the browser's `<select>`: its arrow, and its list (the iOS wheel, the Android sheet, the computer's menu). | `src/lib/phone-fields.svelte:20`, `src/routes/make/parts/FilesQuestion.svelte:217`; rendered `appearance: auto` | Everyone who signs in or joins; makers | Ruken's own picker: the paper choice cards the questions already use (`.picks` / `.pick`, `look.css:946`), opened from a field-shaped button, with the native `<select>` kept only for no-script. |
| 4 | **Radio buttons on Join.** The plan choice draws the browser's circle (only tinted with `accent-color`). | `src/routes/join/+page.svelte:88`, `:92`; `look.css:416` (`accent-color`), `:458`; rendered `appearance: auto` | Everyone who pays | Draw the circle (`appearance: none` and a Ruken dot), as the theme picker and `.pick` cards already hide theirs. |
| 5 | **Small typing defaults.** The highlight when words are selected is the system blue (rendered `::selection` unset); a field the browser fills from saved details turns pale blue or yellow (`:autofill`, no rule); placeholder words (`MM`, `DD`, `YYYY`) are the browser's grey; the websites box has the browser's corner resize grip. | `look.css` has no `::selection`, `:autofill` or `::placeholder` rule; `src/routes/sign-up/+page.svelte:77`, `:88`, `:99`; `look.css:803` (`resize: vertical`) | Everyone who types | Ruken colours for selection, filled-in fields and placeholders; the websites box grows with its lines (`field-sizing: content`, as the game's line already does at `look.css:809`) with no grip. |
| 6 | **The pop-up's backdrop.** `dialog.viewer` keeps the browser's `::backdrop`. It is hidden today because the viewer fills the window, and it goes away with item 1. | `look.css:1393` | Nobody today | Folded into item 1. |

## Already covered by open work

These were on the coordinator's list and are fixed by **#323** ("Panels feel like an app"), PASS at `7c6b49a`, not merged yet: the grey tap flash (rendered `-webkit-tap-highlight-color: rgba(0, 0, 0, 0.18)` on `main`), the long-press menu on links, pictures and videos, dragging a picture, selecting buttons and labels, double-tap zoom, pinch zoom on the feed and play screen, bounce and pull-to-refresh. No change here until it merges; the spec checks it did.

Already custom on `main`: the focus ring (`look.css:247`), the fold-out arrow on `<details>` (`look.css:390`–`412`), file choosing (the input is hidden under Ruken's own button, `look.css:578`), the theme picker's and question cards' radio buttons (hidden, `ThemePicker.svelte:86`, `look.css:973`), page loading and the spinners (#309, #317, #324).

## Not found

- No `alert`, `confirm` or `prompt` anywhere in `src`.
- No browser checking of forms: no `required`, `pattern`, `type="email"`, `type="url"` or `type="number"`, so the browser's "Please fill in this field" bubble never appears; every refusal is Ruken's own words from the server.
- No date, time, colour, range or checkbox inputs. No `title` tooltips (the one `title` is on the game's frame, which only screen readers read).

## Kept as the system's, on purpose (recommendation)

These are drawn by the phone or computer, not the web page, and a real app uses the same ones. Replacing them would take away something people rely on or is not possible from a web page. The spec lists them so the owner can overrule.

- **The share sheet** (`navigator.share`, `Feed.svelte:173`, `g/[game]/+page.svelte:60`): it is the phone's own list of apps and contacts; a Ruken copy could not reach them.
- **The file chooser and the photo library** when a maker adds a video or picture: the system's, and only it can reach the person's files.
- **Saved passwords and one-time codes** the keyboard offers on sign-in and sign-up (`autocomplete`): turning them off makes signing in harder.
- **The keyboard itself**, and the right-click menu on a computer: blocking right-click breaks copy and paste and reads as broken.
- **What a web page cannot change**: the address shown at the bottom left when a computer's pointer rests on a link, the "Press Esc to exit full screen" notice when the play screen goes full screen (`g/[game]/play/+page.svelte:278`), and Safari's address bar. Adding Ruken to the home screen (#320, full screen) removes the address bar.

## What the build needs to check

- Item 1 on a phone runs in WebKit (the iPhone's engine), which this container lacks; the journeys run there in CI.
- Item 3 changes sign-in and sign-up, which the journeys drive by label (`getByLabel`): the picker keeps the same labels so the journeys keep finding it.
- Everything keeps working with no script: the `<noscript>` and no-script paths keep the browser's own video and list, which is the only way they can work without script.
