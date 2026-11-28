import { test } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { PAD, plugInPad, pressPad } from "./support/pad.ts";
test.use({ storageState: NOT_CONSENTED });
test("debug", async ({ page }) => {
  await plugInPad(page);
  await page.goto("/");
  await pageHasSettled(page);
  const f = () => page.evaluate(() => { const a = document.activeElement as HTMLElement; const b=a.getBoundingClientRect(); return `${a.tagName} ${(a.getAttribute("aria-label") ?? a.innerText).trim().slice(0,30)} y=${Math.round(b.y)}`; });
  await pressPad(page, PAD.right); console.log("first", await f());
  for (let i = 0; i < 14; i++) { await pressPad(page, PAD.right); console.log("right", await f()); }
  console.log("card", await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => x.innerText.includes("I agree")); if (!b) return "none"; const r=b.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2); return JSON.stringify(r)+" hit="+hit?.tagName+"."+hit?.className + " inert=" + (b.closest("[inert],[aria-hidden='true']")?.outerHTML.slice(0,80)); }));
});
