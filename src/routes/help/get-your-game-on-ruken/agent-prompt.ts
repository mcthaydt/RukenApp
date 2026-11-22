// The one prompt a maker pastes into their AI coding helper. It is written to the helper, so it can name things a maker
// never has to (Git LFS, a link to another file), but every rule in it is one Ruken's own checks hold a game to: the
// file limits and refusals in src/features/games/files-check.ts, and the other websites a game may reach in the game
// gate (src/features/play/gate.ts). When one of those changes, this changes with it.
export const AGENT_PROMPT = `Help me put my game on Ruken (ruken.io). Ruken is a website where people find web games and play them. It copies a game from GitHub and runs it in a web browser, on phones and on computers.

Please get my game ready and onto GitHub. Don't change how the game plays. Ask me before you delete anything.

1. Make the game run in a web browser, starting from a file called index.html. If it was made with a game engine, export it for the web (HTML5 or WebGL).
2. Make it work on a phone (touch, a screen taller than wide) and on a computer (mouse and keyboard, a screen wider than tall). It should fit the window at any size.
3. Ruken copies one folder of the repository. Keep to its rules:
   - index.html is at the top of that folder.
   - Addresses in index.html don't start with a single slash: write game.js, not /game.js. The game runs in its own folder.
   - Real files only: no links to other files, and nothing stored with Git LFS.
   - At most 1,500 files, no file over 50 MB, and 400 MB in all.
   - Plain file names: no backslashes or % signs, and paths under 300 characters.
4. While it plays, the game can only send to or fetch from five other websites at most, and I list them on Ruken (like api.example.com). Tell me which websites it talks to, if any.
5. Put the game on GitHub in its own repository. Use the gh command if it's installed. Then tell me the repository's name, its branch, and the folder that holds index.html (if it isn't at the top).
6. I also need two short videos of the game being played, 10 to 30 seconds each, up to 30 MB, as MP4, WebM or MOV: one taller than wide for phones, and one wider than tall for computers. If you can't record them, tell me how.

When you're done, give me these steps to finish on Ruken: sign in at ruken.io, go to ruken.io/make, press Add a game, answer the questions (the name, one line about it, where the files are, the two videos, and who it's for), then press Send for review.`;
