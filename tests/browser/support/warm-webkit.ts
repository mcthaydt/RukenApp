// Safari's engine in the journeys draws with the CPU (there is no graphics card in CI), and the first time it draws a
// page on a fresh machine it builds its drawing cache (Mesa's shader cache, kept in ~/.cache), which takes seconds.
// Until that first frame is drawn the page never comes to rest, so a press waits. Measured in Playwright's own image
// with an empty cache: the first frame of /sign-up came after about 2.4 s, and after 76 ms once any page of the site
// had been drawn. In CI two phone workers start together on a busy runner and each pays it at once, which took the
// first press past its 5 seconds (attach-phone.test.ts:15, "waiting for element to be visible, enabled and stable",
// runs 45282074589, 45285923873, 45287060724 and 45290524434). So, once the site is up and before any journey starts,
// one WebKit page of the site is drawn here, and every journey after it finds the cache ready.
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
    await page.evaluate(
      (timeout) =>
        new Promise<void>((drawn, failed) => {
          setTimeout(() => {
            failed(new Error(`warm-webkit: no frame drawn in ${String(timeout)} ms`));
          }, timeout);
          requestAnimationFrame(() => {
            drawn();
          });
        }),
      FIRST_FRAME_TIMEOUT,
    );
  } finally {
    await browser.close();
  }
}
