import { MAKER_AGREEMENT_TEXT, MAKER_AGREEMENT_VERSION } from "../../../features/make/make.ts";
import type { PageServerLoad } from "./$types";

// The maker agreement, word for word from the Owner's file. It needs no account: a maker reads it before agreeing.
export const load: PageServerLoad = () => ({
  version: MAKER_AGREEMENT_VERSION,
  // Plain text, shown as paragraphs: the file puts each point on a line of its own, so a line is a paragraph.
  paragraphs: MAKER_AGREEMENT_TEXT.split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== ""),
});
