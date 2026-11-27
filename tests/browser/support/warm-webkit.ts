// Safari's engine in the journeys draws with the CPU (there is no graphics card in CI), and the first time it draws a
// page on a fresh machine it builds its drawing cache (Mesa's shader cache, kept in ~/.cache), which takes seconds.
// Until that first frame is drawn the page never comes to rest, so a press waits. Measured in Playwright's own image
// with an empty cache: the first frame of /sign-up came after about 2.4 s, and after 76 ms once any page of the site
// had been drawn. In CI two phone workers start together on a busy runner and each pays it at once, which took the
// first press past its 5 seconds (attach-phone.test.ts:15, "waiting for element to be visible, enabled and stable",
// runs 45282074589, 45285923873, 45287060724 and 45290524434). So, once the site is up and before any journey starts,
// one WebKit page of the site is drawn here, and every journey after it finds the cache ready.
// The cache is built for what a page draws. Since plain pages turned solid (the owner, 2026-11-27), /sign-up draws no
// glass, and the feed's frosted bar was built cold by the first journey that opened it: in Playwright's image on 1.5
// cores the feed's first frame came after 7.4 to 7.9 s, and in CI after the 5-second wait (run 45947646204,
// feed-to-game-grow.test.ts:102, twice). So the page is drawn plain and then as glass, marked as a moving screen marks a
// page (src/lib/moving-behind.svelte), which brought that first frame to 4.1 to 5.0 s in the same image (main: 2.0 to
// 3.1 s).
import { devices, webkit, type FullConfig } from "@playwright/test";
import { consented } from "./consent.ts";

/** The longest the first frame may take on a cold, busy machine before the run gives up and says why. */
const FIRST_FRAME_TIMEOUT = 60_000;

export default async function warmWebKit(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (baseURL === undefined) throw new Error("warm-webkit: the config names no baseURL for the site");
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ ...devices["iPhone SE (3rd gen)"], ...consented, baseURL });
    await page.goto("/sign-up");
    for (const glass of [false, true]) {
      const look = await page.evaluate(
        ({ timeout, glass }) =>
          new Promise<string>((drawn, failed) => {
            if (glass) document.documentElement.setAttribute("data-glass", "");
            setTimeout(() => {
              failed(
                new Error(
                  `warm-webkit: no ${glass ? "glass" : "plain"} frame drawn in ${String(timeout)} ms`,
                ),
              );
            }, timeout);
            // A few frames, so the whole look has been drawn and not only its start. The bar's blur says which look.
            let frames = 5;
            const next = () => {
              frames -= 1;
              if (frames > 0) {
                requestAnimationFrame(next);
                return;
              }
              const bar = document.querySelector("nav.bar");
              const style = bar === null ? null : getComputedStyle(bar);
              drawn(style?.backdropFilter || style?.getPropertyValue("-webkit-backdrop-filter") || "none");
            };
            requestAnimationFrame(next);
          }),
        { timeout: FIRST_FRAME_TIMEOUT, glass },
      );
      if (glass !== look.includes("blur(")) {
        throw new Error(`warm-webkit: the ${glass ? "glass" : "plain"} look drew the bar with "${look}"`);
      }
    }
  } finally {
    await browser.close();
  }
}
